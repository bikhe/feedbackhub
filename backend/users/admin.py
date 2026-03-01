from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, AuthToken


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        'email',
        'full_name',
        'role',
        'department',
        'position',
        'is_active',
        'date_joined',
    ]
    list_filter = ['role', 'is_active', 'department', 'date_joined']
    search_fields = ['email', 'first_name', 'last_name', 'position']
    ordering = ['last_name', 'first_name']

    fieldsets = (
        (None, {
            'fields': ('email', 'password'),
        }),
        ('Персональные данные', {
            'fields': (
                'first_name',
                'last_name',
                'patronymic',
                'position',
                'department',
                'avatar_color',
            ),
        }),
        ('Роль и права', {
            'fields': (
                'role',
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            ),
        }),
        ('Даты', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'first_name',
                'last_name',
                'patronymic',
                'role',
                'position',
                'department',
                'password1',
                'password2',
            ),
        }),
    )

    readonly_fields = ['date_joined', 'last_login']

    def full_name(self, obj):
        return obj.full_name
    full_name.short_description = 'ФИО'


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'key_short', 'created_at', 'last_used', 'expires_at', 'is_valid']
    list_filter = ['created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['key', 'created_at', 'last_used']

    def key_short(self, obj):
        return f'{obj.key[:12]}...'
    key_short.short_description = 'Токен'

    def is_valid(self, obj):
        return not obj.is_expired()
    is_valid.boolean = True
    is_valid.short_description = 'Действителен'