from django.conf import settings
from rest_framework import serializers


class FeedbackValidator:
    """Валидатор для отзывов."""

    def __init__(self, author=None):
        self.author = author
        self.limits = settings.FEEDBACK_LIMITS

    def validate_tags(self, tags):
        """
        Проверка тегов:
        - От 1 до 3 тегов
        - Все теги одного sentiment
        - Все теги активны
        """
        if not tags:
            raise serializers.ValidationError(
                f'Выберите хотя бы {self.limits["MIN_TAGS"]} тег.'
            )

        if len(tags) < self.limits['MIN_TAGS']:
            raise serializers.ValidationError(
                f'Минимум {self.limits["MIN_TAGS"]} тег.'
            )

        if len(tags) > self.limits['MAX_TAGS']:
            raise serializers.ValidationError(
                f'Максимум {self.limits["MAX_TAGS"]} тега.'
            )

        # Проверка что все теги активны
        inactive = [t.name for t in tags if not t.is_active]
        if inactive:
            raise serializers.ValidationError(
                f'Неактивные теги: {", ".join(inactive)}'
            )

        # Проверка что все теги одного sentiment
        sentiments = set(t.sentiment for t in tags)
        if len(sentiments) > 1:
            raise serializers.ValidationError(
                'Все теги должны быть одной тональности (позитивные или негативные).'
            )

        return tags

    def validate_comment(self, comment):
        """
        Проверка комментария:
        - Минимум N символов
        - Не пустой после strip
        """
        comment = comment.strip()

        if not comment:
            raise serializers.ValidationError('Комментарий обязателен.')

        if len(comment) < self.limits['MIN_COMMENT_LENGTH']:
            raise serializers.ValidationError(
                f'Комментарий должен содержать минимум {self.limits["MIN_COMMENT_LENGTH"]} символов.'
            )

        return comment

    def validate_self_feedback(self, author, recipient):
        """Нельзя оставить отзыв самому себе."""
        if author.id == recipient.id:
            raise serializers.ValidationError(
                {'recipient': 'Нельзя оставить отзыв самому себе.'}
            )

    def validate_task_active(self, task):
        """Задача должна быть активной."""
        if not task.is_active:
            raise serializers.ValidationError(
                {'task': 'Задача не активна. Выберите другую задачу.'}
            )

    def validate_unique_feedback(self, author, recipient, task, instance=None):
        """Один отзыв на связку автор-получатель-задача."""
        from .models import Feedback

        qs = Feedback.objects.filter(
            author=author,
            recipient=recipient,
            task=task,
        )

        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                'Вы уже оставляли отзыв этому коллеге по данной задаче.'
            )

    def validate_limits(self, author, recipient):
        """Проверка всех лимитов."""
        from datetime import timedelta
        from django.utils import timezone
        from .models import Feedback

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())

        # Дневной лимит
        today_count = Feedback.objects.filter(
            author=author,
            created_at__gte=today_start,
        ).count()

        if today_count >= self.limits['MAX_PER_DAY']:
            raise serializers.ValidationError(
                f'Достигнут дневной лимит: {self.limits["MAX_PER_DAY"]} отзывов. '
                'Попробуйте завтра.'
            )

        # Недельный лимит
        week_count = Feedback.objects.filter(
            author=author,
            created_at__gte=week_start,
        ).count()

        if week_count >= self.limits['MAX_PER_WEEK']:
            raise serializers.ValidationError(
                f'Достигнут недельный лимит: {self.limits["MAX_PER_WEEK"]} отзывов. '
                'Лимит обновится в понедельник.'
            )

        # Лимит на коллегу за неделю
        colleague_count = Feedback.objects.filter(
            author=author,
            recipient=recipient,
            created_at__gte=week_start,
        ).count()

        if colleague_count >= self.limits['MAX_PER_COLLEAGUE_PER_WEEK']:
            raise serializers.ValidationError(
                f'Достигнут лимит отзывов на этого коллегу: '
                f'{self.limits["MAX_PER_COLLEAGUE_PER_WEEK"]} в неделю.'
            )

    def validate_all(self, author, recipient, task, tags, comment, instance=None):
        """Полная валидация отзыва."""
        errors = {}

        try:
            self.validate_self_feedback(author, recipient)
        except serializers.ValidationError as e:
            errors.update(e.detail if hasattr(e, 'detail') else {'recipient': str(e)})

        try:
            self.validate_task_active(task)
        except serializers.ValidationError as e:
            errors.update(e.detail if hasattr(e, 'detail') else {'task': str(e)})

        try:
            self.validate_unique_feedback(author, recipient, task, instance)
        except serializers.ValidationError as e:
            errors['non_field_errors'] = [str(e.detail) if hasattr(e, 'detail') else str(e)]

        try:
            self.validate_limits(author, recipient)
        except serializers.ValidationError as e:
            if 'non_field_errors' not in errors:
                errors['non_field_errors'] = []
            errors['non_field_errors'].append(str(e.detail) if hasattr(e, 'detail') else str(e))

        try:
            self.validate_tags(tags)
        except serializers.ValidationError as e:
            errors['tags'] = e.detail if hasattr(e, 'detail') else [str(e)]

        try:
            self.validate_comment(comment)
        except serializers.ValidationError as e:
            errors['comment'] = e.detail if hasattr(e, 'detail') else [str(e)]

        if errors:
            raise serializers.ValidationError(errors)