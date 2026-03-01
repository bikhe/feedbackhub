import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.core.validators import MinLengthValidator


class Tag(models.Model):
    class Sentiment(models.TextChoices):
        POSITIVE = 'positive', 'Позитивный'
        NEGATIVE = 'negative', 'Негативный'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=100)
    slug = models.SlugField('Slug', max_length=100, unique=True, blank=True)
    sentiment = models.CharField('Тональность', max_length=20, choices=Sentiment.choices, db_index=True)
    icon = models.CharField('Иконка', max_length=50, default='👍')
    description = models.TextField('Описание', blank=True, default='')
    color = models.CharField('Цвет', max_length=7, default='#1890ff')
    sort_order = models.PositiveIntegerField('Порядок сортировки', default=0, db_index=True)
    is_active = models.BooleanField('Активен', default=True, db_index=True)
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)

    class Meta:
        verbose_name = 'Тег'
        verbose_name_plural = 'Теги'
        ordering = ['sentiment', 'sort_order', 'name']

    def __str__(self):
        return f'{self.name}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True) or f'tag-{uuid.uuid4().hex[:8]}'
        super().save(*args, **kwargs)

    @classmethod
    def get_active_positive(cls):
        return cls.objects.filter(is_active=True, sentiment=cls.Sentiment.POSITIVE).order_by('sort_order', 'name')

    @classmethod
    def get_active_negative(cls):
        return cls.objects.filter(is_active=True, sentiment=cls.Sentiment.NEGATIVE).order_by('sort_order', 'name')


class Feedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks_given')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks_received')
    task = models.ForeignKey('tasks.Task', on_delete=models.CASCADE, related_name='feedbacks')
    tags = models.ManyToManyField(Tag, related_name='feedbacks')
    comment = models.TextField('Комментарий', validators=[MinLengthValidator(10)])
    is_anonymous = models.BooleanField('Анонимный отзыв', default=False)
    created_at = models.DateTimeField('Создан', auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)

    class Meta:
        verbose_name = 'Отзыв'
        verbose_name_plural = 'Отзывы'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['author', 'recipient', 'task'], name='unique_feedback_per_task'),
        ]

    @property
    def sentiment(self):
        tag_sentiments = self.tags.values_list('sentiment', flat=True)
        return tag_sentiments[0] if tag_sentiments else None

    @classmethod
    def get_user_limits_status(cls, user):
        from datetime import timedelta
        from django.db.models import Count

        limits = settings.FEEDBACK_LIMITS
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        today_count = cls.objects.filter(author=user, created_at__gte=today_start).count()
        week_count = cls.objects.filter(author=user, created_at__gte=week_start).count()

        by_colleague_raw = dict(
            cls.objects.filter(author=user, created_at__gte=week_start)
            .values('recipient')
            .annotate(count=Count('id'))
            .values_list('recipient', 'count')
        )
        by_colleague = {str(k): v for k, v in by_colleague_raw.items()}

        return {
            'today': {
                'used': today_count,
                'limit': limits['MAX_PER_DAY'],
                'remaining': max(0, limits['MAX_PER_DAY'] - today_count),
            },
            'week': {
                'used': week_count,
                'limit': limits['MAX_PER_WEEK'],
                'remaining': max(0, limits['MAX_PER_WEEK'] - week_count),
            },
            'by_colleague': by_colleague,
            'max_per_colleague': limits['MAX_PER_COLLEAGUE_PER_WEEK'],
        }

    @classmethod
    def can_give_feedback(cls, author, recipient, task):
        from datetime import timedelta
        limits = settings.FEEDBACK_LIMITS
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        if author.id == recipient.id: return False, 'Нельзя оценить себя.'
        if cls.objects.filter(author=author, recipient=recipient, task=task).exists(): return False, 'Отзыв уже оставлен.'
        
        today_count = cls.objects.filter(author=author, created_at__gte=today_start).count()
        if today_count >= limits['MAX_PER_DAY']: return False, 'Дневной лимит исчерпан.'

        week_count = cls.objects.filter(author=author, created_at__gte=week_start).count()
        if week_count >= limits['MAX_PER_WEEK']: return False, 'Недельный лимит исчерпан.'

        colleague_week_count = cls.objects.filter(author=author, recipient=recipient, created_at__gte=week_start).count()
        if colleague_week_count >= limits['MAX_PER_COLLEAGUE_PER_WEEK']: return False, 'Лимит отзывов на коллегу исчерпан.'

        if not task.is_active: return False, 'Задача не активна.'

        return True, None
