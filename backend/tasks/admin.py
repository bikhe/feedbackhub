from django.contrib import admin
from django.utils import timezone
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'code',
        'title_short',
        'status',
        'priority',
        'created_by',
        'assignee_list',
        'deadline',
        'is_overdue_display',
        'feedback_count',
        'created_at',
    ]
    list_filter = ['status', 'priority', 'created_at', 'deadline']
    search_fields = ['title', 'code', 'description']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']

    filter_horizontal = ['assignees']

    fieldsets = (
        (None, {
            'fields': ('code', 'title', 'description'),
        }),
        ('Статус и приоритет', {
            'fields': ('status', 'priority', 'deadline'),
        }),
        ('Участники', {
            'fields': ('created_by', 'assignees'),
        }),
        ('Системные поля', {
            'fields': ('id', 'created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',),
        }),
    )

    def title_short(self, obj):
        return obj.title[:50] + '...' if len(obj.title) > 50 else obj.title
    title_short.short_description = 'Название'

    def assignee_list(self, obj):
        assignees = obj.assignees.all()[:3]
        names = [a.short_name for a in assignees]
        total = obj.assignees.count()
        result = ', '.join(names)
        if total > 3:
            result += f' (+{total - 3})'
        return result or '—'
    assignee_list.short_description = 'Исполнители'

    def is_overdue_display(self, obj):
        return obj.is_overdue
    is_overdue_display.boolean = True
    is_overdue_display.short_description = 'Просрочена'

    def feedback_count(self, obj):
        return obj.feedback_count
    feedback_count.short_description = 'Отзывы'

    actions = ['make_completed', 'make_archived']

    @admin.action(description='Завершить выбранные задачи')
    def make_completed(self, request, queryset):
        count = 0
        for task in queryset.filter(status='active'):
            task.complete()
            count += 1
        self.message_user(request, f'Завершено задач: {count}')

    @admin.action(description='Архивировать выбранные задачи')
    def make_archived(self, request, queryset):
        count = queryset.exclude(status='archived').update(
            status='archived',
            updated_at=timezone.now(),
        )
        self.message_user(request, f'Архивировано задач: {count}')