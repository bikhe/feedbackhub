from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """Корневой эндпоинт API — информация о системе."""
    return Response({
        'name': 'FeedbackHub API',
        'version': '1.0.0',
        'description': 'Система сбора и аналитики обратной связи между сотрудниками',
        'endpoints': {
            'auth': {
                'login': '/api/auth/login/',
                'logout': '/api/auth/logout/',
                'me': '/api/auth/me/',
            },
            'users': '/api/users/',
            'tasks': '/api/tasks/',
            'feedback': '/api/feedback/',
            'tags': '/api/tags/',
            'analytics': {
                'summary': '/api/analytics/summary/',
                'by_user': '/api/analytics/by-user/',
                'leaderboard': '/api/analytics/leaderboard/',
                'sociometry': '/api/analytics/sociometry/',
                'export': '/api/analytics/export/',
            },
        },
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Проверка состояния сервера."""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = 'ok'
    except Exception as e:
        db_status = f'error: {str(e)}'

    return Response({
        'status': 'ok',
        'database': db_status,
    })


urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API root
    path('api/', api_root, name='api-root'),

    # Health check
    path('api/health/', health_check, name='health-check'),

    # Auth & Users
    path('api/auth/', include('users.urls')),
    path('api/users/', include('users.urls_users')),

    # Tasks
    path('api/tasks/', include('tasks.urls')),

    # Feedback & Tags
    path('api/', include('feedback.urls')),

    # Analytics
    path('api/analytics/', include('analytics.urls')),
]

# Статика и медиа для dev-режима
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)


# ============================================
# Настройка Django Admin
# ============================================
admin.site.site_header = 'FeedbackHub — Администрирование'
admin.site.site_title = 'FeedbackHub Admin'
admin.site.index_title = 'Управление системой обратной связи'