from rest_framework import serializers
from users.serializers import UserShortSerializer
from tasks.serializers import TaskSelectSerializer
from .models import Tag, Feedback
from .validators import FeedbackValidator


# ============================================
# TAG SERIALIZERS
# ============================================

class TagSerializer(serializers.ModelSerializer):
    """Полная информация о теге."""

    feedback_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = [
            'id',
            'name',
            'slug',
            'sentiment',
            'icon',
            'description',
            'color',
            'sort_order',
            'is_active',
            'feedback_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def get_feedback_count(self, obj):
        return obj.feedbacks.count()


class TagShortSerializer(serializers.ModelSerializer):
    """Краткая информация о теге (для списков)."""

    class Meta:
        model = Tag
        fields = [
            'id',
            'name',
            'slug',
            'sentiment',
            'icon',
            'color',
        ]


class TagCreateUpdateSerializer(serializers.ModelSerializer):
    """Создание/обновление тега."""

    class Meta:
        model = Tag
        fields = [
            'id',
            'name',
            'sentiment',
            'icon',
            'description',
            'color',
            'sort_order',
            'is_active',
        ]
        read_only_fields = ['id']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Название обязательно.')

        # Проверка уникальности в рамках sentiment
        sentiment = self.initial_data.get('sentiment')
        qs = Tag.objects.filter(name__iexact=value)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if sentiment and qs.filter(sentiment=sentiment).exists():
            raise serializers.ValidationError(
                'Тег с таким названием и тональностью уже существует.'
            )

        return value

    def validate_color(self, value):
        if not value.startswith('#') or len(value) != 7:
            raise serializers.ValidationError(
                'Цвет должен быть в формате HEX: #RRGGBB'
            )
        return value.upper()


class TagGroupedSerializer(serializers.Serializer):
    """Теги, сгруппированные по sentiment."""

    positive = TagShortSerializer(many=True)
    negative = TagShortSerializer(many=True)


# ============================================
# FEEDBACK SERIALIZERS
# ============================================

class FeedbackListSerializer(serializers.ModelSerializer):
    """Список отзывов (краткая информация)."""

    author = UserShortSerializer(read_only=True)
    recipient = UserShortSerializer(read_only=True)
    task = TaskSelectSerializer(read_only=True)
    tags = TagShortSerializer(many=True, read_only=True)
    sentiment = serializers.CharField(read_only=True)

    class Meta:
        model = Feedback
        fields = [
            'id',
            'author',
            'recipient',
            'task',
            'tags',
            'sentiment',
            'comment',
            'is_anonymous',
            'created_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Если отзыв анонимный и запрашивает получатель — скрыть автора
        request = self.context.get('request')
        if request and instance.is_anonymous:
            if request.user.id == instance.recipient.id:
                data['author'] = {
                    'id': None,
                    'full_name': 'Анонимный коллега',
                    'short_name': 'Аноним',
                    'initials': '??',
                    'avatar_color': '#808080',
                }

        return data


class FeedbackDetailSerializer(serializers.ModelSerializer):
    """Полная информация об отзыве."""

    author = UserShortSerializer(read_only=True)
    recipient = UserShortSerializer(read_only=True)
    task = TaskSelectSerializer(read_only=True)
    tags = TagShortSerializer(many=True, read_only=True)
    sentiment = serializers.CharField(read_only=True)
    is_positive = serializers.BooleanField(read_only=True)
    is_negative = serializers.BooleanField(read_only=True)
    tag_names = serializers.ListField(read_only=True)

    class Meta:
        model = Feedback
        fields = [
            'id',
            'author',
            'recipient',
            'task',
            'tags',
            'tag_names',
            'sentiment',
            'is_positive',
            'is_negative',
            'comment',
            'is_anonymous',
            'created_at',
            'updated_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        request = self.context.get('request')
        if request and instance.is_anonymous:
            if request.user.id == instance.recipient.id:
                data['author'] = {
                    'id': None,
                    'full_name': 'Анонимный коллега',
                    'short_name': 'Аноним',
                    'initials': '??',
                    'avatar_color': '#808080',
                }

        return data


class FeedbackCreateSerializer(serializers.ModelSerializer):
    """Создание отзыва."""

    recipient_id = serializers.UUIDField(write_only=True)
    task_id = serializers.UUIDField(write_only=True)
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        min_length=1,
        max_length=3,
    )

    class Meta:
        model = Feedback
        fields = [
            'id',
            'recipient_id',
            'task_id',
            'tag_ids',
            'comment',
            'is_anonymous',
        ]
        read_only_fields = ['id']

    def validate_recipient_id(self, value):
        from users.models import User

        try:
            recipient = User.objects.get(id=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError('Пользователь не найден.')

        return recipient

    def validate_task_id(self, value):
        from tasks.models import Task

        try:
            task = Task.objects.get(id=value)
        except Task.DoesNotExist:
            raise serializers.ValidationError('Задача не найдена.')

        return task

    def validate_tag_ids(self, value):
        tags = list(Tag.objects.filter(id__in=value, is_active=True))

        if len(tags) != len(value):
            found_ids = {str(t.id) for t in tags}
            missing = [str(v) for v in value if str(v) not in found_ids]
            raise serializers.ValidationError(
                f'Теги не найдены или неактивны: {", ".join(missing)}'
            )

        return tags

    def validate(self, attrs):
        author = self.context['request'].user
        recipient = attrs['recipient_id']  # уже User объект
        task = attrs['task_id']  # уже Task объект
        tags = attrs['tag_ids']  # уже список Tag объектов
        comment = attrs.get('comment', '')

        validator = FeedbackValidator(author=author)
        validator.validate_all(
            author=author,
            recipient=recipient,
            task=task,
            tags=tags,
            comment=comment,
        )

        # Переименовываем для create()
        attrs['recipient'] = attrs.pop('recipient_id')
        attrs['task'] = attrs.pop('task_id')
        attrs['tags_list'] = attrs.pop('tag_ids')
        attrs['comment'] = comment.strip()

        return attrs

    def create(self, validated_data):
        tags_list = validated_data.pop('tags_list')
        author = self.context['request'].user

        feedback = Feedback.objects.create(
            author=author,
            **validated_data,
        )
        feedback.tags.set(tags_list)

        return feedback

    def to_representation(self, instance):
        return FeedbackDetailSerializer(
            instance,
            context=self.context,
        ).data


class FeedbackLimitsSerializer(serializers.Serializer):
    """Сериализатор для лимитов отзывов."""

    today = serializers.DictField()
    week = serializers.DictField()
    by_colleague = serializers.DictField()
    max_per_colleague = serializers.IntegerField()


class FeedbackCheckSerializer(serializers.Serializer):
    """Проверка возможности оставить отзыв."""

    recipient_id = serializers.UUIDField()
    task_id = serializers.UUIDField()

    def validate(self, attrs):
        from users.models import User
        from tasks.models import Task

        try:
            recipient = User.objects.get(id=attrs['recipient_id'], is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {'recipient_id': 'Пользователь не найден.'}
            )

        try:
            task = Task.objects.get(id=attrs['task_id'])
        except Task.DoesNotExist:
            raise serializers.ValidationError(
                {'task_id': 'Задача не найдена.'}
            )

        author = self.context['request'].user

        can_give, error = Feedback.can_give_feedback(author, recipient, task)

        if not can_give:
            raise serializers.ValidationError({'detail': error})

        return {
            'can_give': True,
            'recipient': recipient,
            'task': task,
        }