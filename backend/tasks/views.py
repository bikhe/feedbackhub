import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsManager, IsManagerOrReadOnly
from .models import Task
from .serializers import (
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskSelectSerializer,
    TaskUpdateSerializer,
)

logger = logging.getLogger(__name__)


class TaskViewSet(viewsets.ModelViewSet):
    """
    CRUD для задач.

    GET    /api/tasks/           — список задач
    POST   /api/tasks/           — создать задачу (manager/admin)
    GET    /api/tasks/<id>/      — детали задачи
    PATCH  /api/tasks/<id>/      — обновить задачу (manager/admin)
    DELETE /api/tasks/<id>/      — архивировать задачу (manager/admin)

    GET    /api/tasks/active/    — только активные задачи (для формы отзыва)
    GET    /api/tasks/my/        — мои задачи
    POST   /api/tasks/<id>/complete/ — завершить задачу
    POST   /api/tasks/<id>/archive/  — архивировать задачу
    """

    queryset = Task.objects.all()
    permission_classes = [IsManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'created_by']
    search_fields = ['title', 'code', 'description']
    ordering_fields = ['created_at', 'deadline', 'title', 'priority', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return TaskCreateSerializer
        if self.action in ('update', 'partial_update'):
            return TaskUpdateSerializer
        if self.action in ('active', 'select'):
            return TaskSelectSerializer
        if self.action == 'list':
            return TaskListSerializer
        return TaskDetailSerializer

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        logger.info(f'Task created: {task.code} by {self.request.user.email}')

    def perform_destroy(self, instance):
        """Мягкое удаление — архивация."""
        instance.archive()
        logger.info(f'Task archived: {instance.code}')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        GET /api/tasks/active/
        Активные задачи для формы отзыва.
        """
        tasks = Task.objects.filter(
            status=Task.Status.ACTIVE,
        ).order_by('-created_at')

        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        GET /api/tasks/my/
        Задачи текущего пользователя.
        """
        tasks = Task.objects.filter(
            assignees=request.user,
        ).order_by('-created_at')

        # Фильтр по статусу
        task_status = request.query_params.get('status')
        if task_status:
            tasks = tasks.filter(status=task_status)

        serializer = TaskListSerializer(tasks, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def complete(self, request, pk=None):
        """
        POST /api/tasks/<id>/complete/
        Завершить задачу.
        """
        task = self.get_object()

        if task.status == Task.Status.COMPLETED:
            return Response(
                {'detail': 'Задача уже завершена.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task.complete()
        logger.info(f'Task completed: {task.code} by {request.user.email}')

        return Response(TaskDetailSerializer(task).data)

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def archive(self, request, pk=None):
        """
        POST /api/tasks/<id>/archive/
        Архивировать задачу.
        """
        task = self.get_object()

        if task.status == Task.Status.ARCHIVED:
            return Response(
                {'detail': 'Задача уже в архиве.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task.archive()
        logger.info(f'Task archived: {task.code} by {request.user.email}')

        return Response(TaskDetailSerializer(task).data)

    @action(detail=False, methods=['get'])
    def select(self, request):
        """
        GET /api/tasks/select/
        Минимальный список для select-компонента.
        """
        tasks = Task.objects.filter(
            status=Task.Status.ACTIVE,
        ).order_by('code')

        serializer = TaskSelectSerializer(tasks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/tasks/stats/
        Статистика по задачам.
        """
        from django.db.models import Count

        total = Task.objects.count()
        by_status = dict(
            Task.objects.values_list('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )
        by_priority = dict(
            Task.objects.filter(status='active')
            .values_list('priority')
            .annotate(count=Count('id'))
            .values_list('priority', 'count')
        )

        overdue = Task.objects.filter(
            status='active',
            deadline__lt=__import__('django').utils.timezone.now().date(),
        ).count()

        return Response({
            'total': total,
            'by_status': {
                'active': by_status.get('active', 0),
                'completed': by_status.get('completed', 0),
                'archived': by_status.get('archived', 0),
            },
            'by_priority': {
                'low': by_priority.get('low', 0),
                'medium': by_priority.get('medium', 0),
                'high': by_priority.get('high', 0),
                'critical': by_priority.get('critical', 0),
            },
            'overdue': overdue,
        })