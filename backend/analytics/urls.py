from django.urls import path
from . import views

app_name = 'analytics'

urlpatterns = [
    # Общая сводка
    path('summary/', views.analytics_summary, name='summary'),

    # По пользователям
    path('by-user/', views.analytics_by_user, name='by-user'),

    # Лидерборд
    path('leaderboard/', views.analytics_leaderboard, name='leaderboard'),

    # Тренды
    path('trends/', views.analytics_trends, name='trends'),

    # Социометрия
    path('sociometry/', views.analytics_sociometry, name='sociometry'),

    # Аналитика по тегам
    path('tags/', views.analytics_tags, name='tags'),

    # Экспорт
    path('export/', views.analytics_export, name='export'),
]