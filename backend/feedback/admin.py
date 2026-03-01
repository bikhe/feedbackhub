from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Count
from .models import Tag, Feedback


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """Админка для тегов."""

    list_display = [
        'preview',
        'name',
        'sentiment_badge',
        'color_preview',
        'sort_order',
        'feedback_count',
        'is_active',
        'created_at',
    ]
    list_filter = ['sentiment', 'is_active', 'created_at']
    list_editable = ['sort_order', 'is_active']
    search_fields = ['name', 'slug', 'description']
    ordering = ['sentiment', 'sort_order', 'name']
    readonly_fields = ['id', 'slug', 'created_at', 'updated_at', 'preview_large']
    prepopulated_fields = {}  # slug генерируется автоматически

    fieldsets = (
        (None, {
            'fields': ('name', 'slug', 'sentiment'),
        }),
        ('Отображение', {
            'fields': ('icon', 'color', 'description', 'preview_large'),
        }),
        ('Настройки', {
            'fields': ('sort_order', 'is_active'),
        }),
        ('Системные поля', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def preview(self, obj):
        """Превью тега с иконкой."""
        return format_html(
            '<span style="font-size: 1.2em;">{}</span>',
            obj.icon,
        )
    preview.short_description = ''

    def sentiment_badge(self, obj):
        """Бейдж тональности."""
        colors = {
            'positive': ('#52c41a', '#f6ffed', 'Позитивный'),
            'negative': ('#ff4d4f', '#fff2f0', 'Негативный'),
        }
        bg_color, border_color, label = colors.get(
            obj.sentiment,
            ('#1890ff', '#e6f7ff', obj.sentiment)
        )
        return format_html(
            '<span style="'
            'background: {}; '
            'color: {}; '
            'padding: 2px 8px; '
            'border-radius: 4px; '
            'font-size: 0.85em;"'
            '>{}</span>',
            border_color,
            bg_color,
            label,
        )
    sentiment_badge.short_description = 'Тональность'

    def color_preview(self, obj):
        """Превью цвета."""
        return format_html(
            '<span style="'
            'display: inline-block; '
            'width: 20px; '
            'height: 20px; '
            'background: {}; '
            'border-radius: 4px; '
            'border: 1px solid #d9d9d9;'
            '"></span> {}',
            obj.color,
            obj.color,
        )
    color_preview.short_description = 'Цвет'

    def preview_large(self, obj):
        """Большой превью как будет выглядеть тег."""
        return format_html(
            '<div style="'
            'display: inline-flex; '
            'align-items: center; '
            'gap: 8px; '
            'background: {}; '
            'color: white; '
            'padding: 8px 16px; '
            'border-radius: 16px; '
            'font-size: 1.1em;'
            '">'
            '<span style="font-size: 1.3em;">{}</span>'
            '<span>{}</span>'
            '</div>',
            obj.color,
            obj.icon,
            obj.name,
        )
    preview_large.short_description = 'Предпросмотр'

    def feedback_count(self, obj):
        """Количество отзывов с этим тегом."""
        return obj.feedbacks.count()
    feedback_count.short_description = 'Отзывов'

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _feedback_count=Count('feedbacks')
        )

    actions = ['activate_tags', 'deactivate_tags']

    @admin.action(description='Активировать выбранные теги')
    def activate_tags(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'Активировано тегов: {count}')

    @admin.action(description='Деактивировать выбранные теги')
    def deactivate_tags(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'Деактивировано тегов: {count}')


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """Админка для отзывов."""

    list_display = [
        'id_short',
        'author_link',
        'direction_arrow',
        'recipient_link',
        'task_link',
        'sentiment_badge',
        'tags_list',
        'comment_short',
        'is_anonymous',
        'created_at',
    ]
    list_filter = [
        'is_anonymous',
        'created_at',
        'tags__sentiment',
        ('author', admin.RelatedOnlyFieldListFilter),
        ('recipient', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'author__email',
        'author__first_name',
        'author__last_name',
        'recipient__email',
        'recipient__first_name',
        'recipient__last_name',
        'task__code',
        'task__title',
        'comment',
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'id',
        'author',
        'recipient',
        'task',
        'created_at',
        'updated_at',
    ]
    filter_horizontal = ['tags']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Участники', {
            'fields': ('author', 'recipient', 'task'),
        }),
        ('Содержание', {
            'fields': ('tags', 'comment', 'is_anonymous'),
        }),
        ('Системные поля', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def id_short(self, obj):
        return str(obj.id)[:8]
    id_short.short_description = 'ID'

    def author_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.author.id,
            obj.author.short_name,
        )
    author_link.short_description = 'Автор'

    def direction_arrow(self, obj):
        return '→'
    direction_arrow.short_description = ''

    def recipient_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.recipient.id,
            obj.recipient.short_name,
        )
    recipient_link.short_description = 'Получатель'

    def task_link(self, obj):
        return format_html(
            '<a href="/admin/tasks/task/{}/change/">[{}]</a>',
            obj.task.id,
            obj.task.code,
        )
    task_link.short_description = 'Задача'

    def sentiment_badge(self, obj):
        sentiment = obj.sentiment
        if sentiment == 'positive':
            return format_html(
                '<span style="color: #52c41a; font-size: 1.2em;">👍</span>'
            )
        elif sentiment == 'negative':
            return format_html(
                '<span style="color: #ff4d4f; font-size: 1.2em;">👎</span>'
            )
        return '—'
    sentiment_badge.short_description = 'Тон'

    def tags_list(self, obj):
        tags = obj.tags.all()[:3]
        result = ' '.join([t.icon for t in tags])
        if obj.tags.count() > 3:
            result += f' +{obj.tags.count() - 3}'
        return result or '—'
    tags_list.short_description = 'Теги'

    def comment_short(self, obj):
        return obj.comment[:50] + '...' if len(obj.comment) > 50 else obj.comment
    comment_short.short_description = 'Комментарий'

    def has_add_permission(self, request):
        """Отзывы создаются только через API."""
        return False

    def has_change_permission(self, request, obj=None):
        """Отзывы не редактируются."""
        return False