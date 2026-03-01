from django.shortcuts import render

# Create your views here.
import logging

from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import AuthToken, User
from .permissions import IsAdmin, IsSelfOrAdmin
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserShortSerializer,
    UserUpdateSerializer,
)

logger = logging.getLogger(__name__)


# ============================================
# AUTH VIEWS
# ============================================

class LoginView(generics.GenericAPIView):
    """
    POST /api/auth/login/
    Вход в систему. Возвращает токен.
    """
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # Удаляем старые токены (оставляем максимум 5)
        tokens = user.auth_tokens.order_by('-created_at')
        if tokens.count() >= 5:
            tokens_to_delete = tokens[4:]
            AuthToken.objects.filter(
                id__in=[t.id for t in tokens_to_delete]
            ).delete()

        # Создаём новый токен
        token = AuthToken.objects.create(user=user)

        # Обновляем last_login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        logger.info(f'User logged in: {user.email}')

        return Response({
            'token': token.key,
            'user': UserDetailSerializer(user).data,
        })


class LogoutView(generics.GenericAPIView):
    """
    POST /api/auth/logout/
    Выход из системы. Удаляет текущий токен.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # request.auth — это AuthToken (из authentication.py)
        if request.auth and hasattr(request.auth, 'delete'):
            request.auth.delete()

        logger.info(f'User logged out: {request.user.email}')

        return Response({'detail': 'Выход выполнен.'})


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET /api/auth/me/ — текущий пользователь
    PATCH /api/auth/me/ — обновить свой профиль
    """
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserDetailSerializer


class ChangePasswordView(generics.GenericAPIView):
    """
    POST /api/auth/change-password/
    Смена пароля текущего пользователя.
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])

        # Удаляем все токены кроме текущего
        if request.auth:
            request.user.auth_tokens.exclude(pk=request.auth.pk).delete()

        logger.info(f'Password changed: {request.user.email}')

        return Response({'detail': 'Пароль успешно изменён.'})


# ============================================
# USER MANAGEMENT VIEWS (admin)
# ============================================

class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD для пользователей.
    GET /api/users/ — список (все аутентифицированные)
    POST /api/users/ — создание (только admin)
    GET /api/users/<id>/ — детали
    PATCH /api/users/<id>/ — обновление (admin или сам пользователь)
    DELETE /api/users/<id>/ — деактивация (только admin)
    """
    queryset = User.objects.all()
    filterset_fields = ['role', 'is_active', 'department']
    search_fields = ['first_name', 'last_name', 'email', 'position']
    ordering_fields = ['last_name', 'date_joined', 'role']
    ordering = ['last_name', 'first_name']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        if self.action == 'list':
            return UserShortSerializer
        return UserDetailSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdmin()]
        if self.action in ('update', 'partial_update'):
            return [IsSelfOrAdmin()]
        if self.action == 'destroy':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def perform_destroy(self, instance):
        """Мягкое удаление — деактивация."""
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        logger.info(f'User deactivated: {instance.email}')

    @action(detail=False, methods=['get'])
    def colleagues(self, request):
        """
        GET /api/users/colleagues/
        Список коллег (все активные, кроме текущего).
        Используется для выбора получателя отзыва.
        """
        users = User.objects.filter(
            is_active=True,
        ).exclude(
            id=request.user.id,
        ).order_by('last_name', 'first_name')

        serializer = UserShortSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def employees(self, request):
        """
        GET /api/users/employees/
        Список сотрудников (для менеджера).
        """
        users = User.objects.filter(
            is_active=True,
            role='employee',
        ).order_by('last_name', 'first_name')

        serializer = UserShortSerializer(users, many=True)
        return Response(serializer.data)