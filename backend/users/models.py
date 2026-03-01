import uuid
import hashlib
import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Менеджер кастомной модели пользователя."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        extra_fields.setdefault('role', 'employee')
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser должен иметь is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser должен иметь is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Кастомная модель пользователя."""

    class Role(models.TextChoices):
        EMPLOYEE = 'employee', 'Сотрудник'
        MANAGER = 'manager', 'Руководитель'
        ADMIN = 'admin', 'Администратор'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    email = models.EmailField(
        'Email',
        unique=True,
        db_index=True,
    )
    first_name = models.CharField(
        'Имя',
        max_length=100,
    )
    last_name = models.CharField(
        'Фамилия',
        max_length=100,
    )
    patronymic = models.CharField(
        'Отчество',
        max_length=100,
        blank=True,
        default='',
    )
    role = models.CharField(
        'Роль',
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        db_index=True,
    )
    position = models.CharField(
        'Должность',
        max_length=200,
        blank=True,
        default='',
    )
    department = models.CharField(
        'Отдел',
        max_length=200,
        blank=True,
        default='',
    )
    avatar_color = models.CharField(
        'Цвет аватара',
        max_length=7,
        default='#1890ff',
        help_text='HEX цвет для отображения аватара',
    )
    is_active = models.BooleanField(
        'Активен',
        default=True,
    )
    is_staff = models.BooleanField(
        'Доступ к админке',
        default=False,
    )
    date_joined = models.DateTimeField(
        'Дата регистрации',
        default=timezone.now,
    )
    last_login = models.DateTimeField(
        'Последний вход',
        null=True,
        blank=True,
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f'{self.full_name} ({self.email})'

    @property
    def full_name(self):
        parts = [self.last_name, self.first_name]
        if self.patronymic:
            parts.append(self.patronymic)
        return ' '.join(parts)

    @property
    def short_name(self):
        short = self.last_name
        if self.first_name:
            short += f' {self.first_name[0]}.'
        if self.patronymic:
            short += f'{self.patronymic[0]}.'
        return short

    @property
    def initials(self):
        first = self.first_name[0] if self.first_name else ''
        last = self.last_name[0] if self.last_name else ''
        return f'{first}{last}'.upper()

    @property
    def is_manager(self):
        return self.role in (self.Role.MANAGER, self.Role.ADMIN)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN


class AuthToken(models.Model):
    """Токен аутентификации."""

    key = models.CharField(
        'Ключ',
        max_length=64,
        unique=True,
        db_index=True,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='auth_tokens',
        verbose_name='Пользователь',
    )
    created_at = models.DateTimeField(
        'Создан',
        auto_now_add=True,
    )
    last_used = models.DateTimeField(
        'Последнее использование',
        auto_now=True,
    )
    expires_at = models.DateTimeField(
        'Истекает',
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = 'Токен'
        verbose_name_plural = 'Токены'
        ordering = ['-created_at']

    def __str__(self):
        return f'Token for {self.user.email} ({self.key[:8]}...)'

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.generate_key()
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    def is_expired(self):
        if self.expires_at is None:
            return False
        return timezone.now() >= self.expires_at

    @staticmethod
    def generate_key():
        return hashlib.sha256(os.urandom(32)).hexdigest()