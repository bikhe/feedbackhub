import logging
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsManager, IsManagerOrReadOnly
from .models import Tag, Feedback
from .serializers import (
    TagSerializer,
    TagShortSerializer,
    TagCreateUpdateSerializer,
    TagGroupedSerializer,
    FeedbackListSerializer,
    FeedbackDetailSerializer,
    FeedbackCreateSerializer,
    FeedbackLimitsSerializer,
    FeedbackCheckSerializer,
)

logger = logging.getLogger(__name__)


# ============================================
# TAG VIEWS
# ============================================

class TagViewSet(viewsets.ModelViewSet):
    """
    CRUD для тегов.

    GET    /api/tags/           — список всех тегов
    POST   /api/tags/           — создать тег (manager/admin)
    GET    /api/tags/<id>/      — детали тега
    PATCH  /api/tags/<id>/      — обновить тег (manager/admin)
    DELETE /api/tags/<id>/      — деактивировать тег (manager/admin)

    GET    /api/tags/active/    — активные теги (для формы)
    GET    /api/tags/grouped/   — теги по группам (positive/negative)
    """

    queryset = Tag.objects.all()
    permission_classes = [IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['sentiment', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['sort_order', 'name', 'created_at']
    ordering = ['sentiment', 'sort_order', 'name']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return TagCreateUpdateSerializer
        if self.action in ('active', 'grouped'):
            return TagShortSerializer
        if self.action == 'list':
            return TagSerializer
        return TagSerializer

    def perform_destroy(self, instance):
        """Мягкое удаление — деактивация."""
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        logger.info(f'Tag deactivated: {instance.name}')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        GET /api/tags/active/
        Активные теги для формы отзыва.
        """
        tags = Tag.objects.filter(is_active=True).order_by('sentiment', 'sort_order', 'name')
        serializer = TagShortSerializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def grouped(self, request):
        """
        GET /api/tags/grouped/
        Теги, сгруппированные по sentiment.
        """
        positive = Tag.get_active_positive()
        negative = Tag.get_active_negative()

        return Response({
            'positive': TagShortSerializer(positive, many=True).data,
            'negative': TagShortSerializer(negative, many=True).data,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def toggle_active(self, request, pk=None):
        """
        POST /api/tags/<id>/toggle_active/
        Переключить активность тега.
        """
        tag = self.get_object()
        tag.is_active = not tag.is_active
        tag.save(update_fields=['is_active', 'updated_at'])

        return Response(TagSerializer(tag).data)


# ============================================
# FEEDBACK VIEWS
# ============================================

class FeedbackViewSet(viewsets.ModelViewSet):
    """
    CRUD для отзывов.

    GET    /api/feedback/           — список отзывов
    POST   /api/feedback/           — создать отзыв
    GET    /api/feedback/<id>/      — детали отзыва
    DELETE /api/feedback/<id>/      — удалить отзыв (только свой, в течение 24ч)

    GET    /api/feedback/my/        — мои отзывы (которые я оставил)
    GET    /api/feedback/received/  — полученные отзывы
    GET    /api/feedback/limits/    — мои лимиты
    POST   /api/feedback/check/     — проверить возможность оставить отзыв
    """

    queryset = Feedback.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['author', 'recipient', 'task', 'is_anonymous']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return FeedbackCreateSerializer
        if self.action == 'check':
            return FeedbackCheckSerializer
        if self.action in ('list', 'my', 'received'):
            return FeedbackListSerializer
        return FeedbackDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Менеджеры и админы видят все отзывы
        if user.is_manager:
            return qs.select_related('author', 'recipient', 'task').prefetch_related('tags')

        # Обычные пользователи видят только свои (оставленные и полученные)
        return qs.filter(
            Q(author=user) | Q(recipient=user)
        ).select_related('author', 'recipient', 'task').prefetch_related('tags')

    def perform_create(self, serializer):
        feedback = serializer.save()
        logger.info(
            f'Feedback created: {feedback.author.email} → {feedback.recipient.email} '
            f'(task: {feedback.task.code})'
        )

    def destroy(self, request, *args, **kwargs):
        """Удаление отзыва с проверками."""
        instance = self.get_object()

        # Только автор может удалить
        if instance.author != request.user and not request.user.is_manager:
            return Response(
                {'detail': 'Вы можете удалить только свои отзывы.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Только в течение 24 часов
        from django.utils import timezone
        from datetime import timedelta

        if not request.user.is_manager:
            time_limit = instance.created_at + timedelta(hours=24)
            if timezone.now() > time_limit:
                return Response(
                    {'detail': 'Отзыв можно удалить только в течение 24 часов после создания.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        logger.info(f'Feedback deleted: {instance.id} by {request.user.email}')
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        GET /api/feedback/my/
        Отзывы, которые я оставил.
        """
        feedbacks = Feedback.objects.filter(
            author=request.user,
        ).select_related(
            'author', 'recipient', 'task'
        ).prefetch_related('tags').order_by('-created_at')

        page = self.paginate_queryset(feedbacks)
        if page is not None:
            serializer = FeedbackListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = FeedbackListSerializer(feedbacks, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def received(self, request):
        """
        GET /api/feedback/received/
        Отзывы, которые я получил.
        """
        feedbacks = Feedback.objects.filter(
            recipient=request.user,
        ).select_related(
            'author', 'recipient', 'task'
        ).prefetch_related('tags').order_by('-created_at')

        page = self.paginate_queryset(feedbacks)
        if page is not None:
            serializer = FeedbackListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = FeedbackListSerializer(feedbacks, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def limits(self, request):
        """
        GET /api/feedback/limits/
        Текущие лимиты пользователя.
        """
        limits_status = Feedback.get_user_limits_status(request.user)
        return Response(limits_status)

    @action(detail=False, methods=['post'])
    def check(self, request):
        """
        POST /api/feedback/check/
        Проверить, можно ли оставить отзыв.

        Body: { recipient_id, task_id }
        """
        serializer = FeedbackCheckSerializer(
            data=request.data,
            context={'request': request},
        )

        if serializer.is_valid():
            return Response({
                'can_give': True,
                'message': 'Вы можете оставить отзыв.',
            })

        return Response(
            {
                'can_give': False,
                'errors': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/feedback/stats/
        Краткая статистика по отзывам (для dashboard).
        """
        from django.db.models import Count
        from datetime import timedelta
        from django.utils import timezone

        user = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)

        # Мои отзывы
        my_total = Feedback.objects.filter(author=user).count()
        my_week = Feedback.objects.filter(author=user, created_at__gte=week_ago).count()

        # Полученные отзывы
        received_total = Feedback.objects.filter(recipient=user).count()
        received_week = Feedback.objects.filter(recipient=user, created_at__gte=week_ago).count()

        # Sentiment breakdown полученных
        received_positive = Feedback.objects.filter(
            recipient=user,
            tags__sentiment='positive',
        ).distinct().count()

        received_negative = Feedback.objects.filter(
            recipient=user,
            tags__sentiment='negative',
        ).distinct().count()

        return Response({
            'given': {
                'total': my_total,
                'this_week': my_week,
            },
            'received': {
                'total': received_total,
                'this_week': received_week,
                'positive': received_positive,
                'negative': received_negative,
            },
            'limits': Feedback.get_user_limits_status(user),
        })