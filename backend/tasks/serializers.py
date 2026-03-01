from rest_framework import serializers
from users.serializers import UserShortSerializer
from .models import Task


class TaskListSerializer(serializers.ModelSerializer):
    """Список задач (краткая информация)."""

    created_by = UserShortSerializer(read_only=True)
    assignee_count = serializers.SerializerMethodField()
    feedback_count = serializers.IntegerField(read_only=True, source='feedbacks.count', default=0)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'code',
            'status',
            'priority',
            'created_by',
            'assignee_count',
            'feedback_count',
            'is_overdue',
            'deadline',
            'created_at',
        ]

    def get_assignee_count(self, obj):
        return obj.assignees.count()


class TaskDetailSerializer(serializers.ModelSerializer):
    """Полная информация о задаче."""

    created_by = UserShortSerializer(read_only=True)
    assignees = UserShortSerializer(many=True, read_only=True)
    feedback_count = serializers.IntegerField(read_only=True, source='feedbacks.count', default=0)
    is_overdue = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'code',
            'status',
            'priority',
            'created_by',
            'assignees',
            'feedback_count',
            'is_overdue',
            'is_active',
            'deadline',
            'created_at',
            'updated_at',
            'completed_at',
        ]


class TaskCreateSerializer(serializers.ModelSerializer):
    """Создание задачи."""

    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        write_only=True,
    )

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'code',
            'status',
            'priority',
            'assignee_ids',
            'deadline',
        ]
        extra_kwargs = {
            'code': {'required': False},
        }

    def validate_code(self, value):
        if value and Task.objects.filter(code=value).exists():
            raise serializers.ValidationError('Задача с таким кодом уже существует.')
        return value

    def validate_assignee_ids(self, value):
        if value:
            from users.models import User
            existing = User.objects.filter(
                id__in=value,
                is_active=True,
            ).values_list('id', flat=True)
            missing = set(str(v) for v in value) - set(str(e) for e in existing)
            if missing:
                raise serializers.ValidationError(
                    f'Пользователи не найдены: {", ".join(missing)}'
                )
        return value

    def create(self, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', [])
        task = Task.objects.create(**validated_data)
        if assignee_ids:
            task.assignees.set(assignee_ids)
        return task


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Обновление задачи."""

    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Task
        fields = [
            'title',
            'description',
            'status',
            'priority',
            'assignee_ids',
            'deadline',
        ]

    def validate_assignee_ids(self, value):
        if value:
            from users.models import User
            existing = User.objects.filter(
                id__in=value,
                is_active=True,
            ).values_list('id', flat=True)
            missing = set(str(v) for v in value) - set(str(e) for e in existing)
            if missing:
                raise serializers.ValidationError(
                    f'Пользователи не найдены: {", ".join(missing)}'
                )
        return value

    def update(self, instance, validated_data):
        assignee_ids = validated_data.pop('assignee_ids', None)

        # Если статус меняется на completed
        if validated_data.get('status') == 'completed' and instance.status != 'completed':
            from django.utils import timezone
            validated_data['completed_at'] = timezone.now()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if assignee_ids is not None:
            instance.assignees.set(assignee_ids)

        return instance


class TaskSelectSerializer(serializers.ModelSerializer):
    """Минимальная информация для выпадающего списка."""

    label = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ['id', 'title', 'code', 'status', 'label']

    def get_label(self, obj):
        return f'[{obj.code}] {obj.title}'