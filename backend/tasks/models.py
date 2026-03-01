import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Task(models.Model):
    """Задача, к которой привязывается отзыв."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Активна'
        COMPLETED = 'completed', 'Завершена'
        ARCHIVED = 'archived', 'В архиве'

    class Priority(models.TextChoices):
        LOW = 'low', 'Низкий'
        MEDIUM = 'medium', 'Средний'
        HIGH = 'high', 'Высокий'
        CRITICAL = 'critical', 'Критический'

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    title = models.CharField(
        'Название',
        max_length=300,
        db_index=True,
    )
    description = models.TextField(
        'Описание',
        blank=True,
        default='',
    )
    code = models.CharField(
        'Код задачи',
        max_length=50,
        unique=True,
        db_index=True,
        help_text='Уникальный код, например: PROJ-123',
    )
    status = models.CharField(
        'Статус',
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    priority = models.CharField(
        'Приоритет',
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_tasks',
        verbose_name='Создал',
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='assigned_tasks',
        verbose_name='Исполнители',
        help_text='Сотрудники, назначенные на задачу',
    )
    deadline = models.DateField(
        'Дедлайн',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        'Создана',
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        'Обновлена',
        auto_now=True,
    )
    completed_at = models.DateTimeField(
        'Завершена',
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.code}] {self.title}'

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    @property
    def is_overdue(self):
        if not self.deadline:
            return False
        if self.status == self.Status.COMPLETED:
            return False
        return self.deadline < timezone.now().date()

    @property
    def feedback_count(self):
        return self.feedbacks.count()

    def complete(self):
        """Завершить задачу."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at', 'updated_at'])

    def archive(self):
        """Архивировать задачу."""
        self.status = self.Status.ARCHIVED
        self.save(update_fields=['status', 'updated_at'])

    def save(self, *args, **kwargs):
        # Автогенерация кода если не задан
        if not self.code:
            self.code = self._generate_code()
        super().save(*args, **kwargs)

    def _generate_code(self):
        """Генерация уникального кода задачи."""
        last_task = Task.objects.order_by('-created_at').first()
        if last_task and last_task.code.startswith('TASK-'):
            try:
                num = int(last_task.code.split('-')[1]) + 1
            except (IndexError, ValueError):
                num = 1
        else:
            num = 1
        return f'TASK-{num:04d}'