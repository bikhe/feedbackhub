import logging
from datetime import timedelta

from django.db.models import Count, Q, F
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsManager
from users.models import User
from users.serializers import UserShortSerializer
from feedback.models import Feedback, Tag
from tasks.models import Task
from .export import ExcelExporter

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_summary(request):
    """
    GET /api/analytics/summary/
    Общая сводка по системе (для dashboard менеджера).
    """
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    # Общие цифры
    total_users = User.objects.filter(is_active=True).count()
    total_feedbacks = Feedback.objects.count()
    total_tasks = Task.objects.count()
    active_tasks = Task.objects.filter(status='active').count()

    # За сегодня
    today_feedbacks = Feedback.objects.filter(created_at__gte=today_start).count()

    # За неделю
    week_feedbacks = Feedback.objects.filter(created_at__gte=week_start).count()

    # За месяц
    month_feedbacks = Feedback.objects.filter(created_at__gte=month_start).count()

    # По sentiment
    positive_count = Feedback.objects.filter(tags__sentiment='positive').distinct().count()
    negative_count = Feedback.objects.filter(tags__sentiment='negative').distinct().count()

    # Активность пользователей (кто оставлял отзывы за неделю)
    active_authors = Feedback.objects.filter(
        created_at__gte=week_start
    ).values('author').distinct().count()

    # Топ тегов
    top_tags = Tag.objects.filter(
        is_active=True,
        feedbacks__created_at__gte=month_start,
    ).annotate(
        usage_count=Count('feedbacks')
    ).order_by('-usage_count')[:10]

    top_tags_data = [
        {
            'id': str(tag.id),
            'name': tag.name,
            'icon': tag.icon,
            'color': tag.color,
            'sentiment': tag.sentiment,
            'count': tag.usage_count,
        }
        for tag in top_tags
    ]

    return Response({
        'totals': {
            'users': total_users,
            'feedbacks': total_feedbacks,
            'tasks': total_tasks,
            'active_tasks': active_tasks,
        },
        'period': {
            'today': today_feedbacks,
            'week': week_feedbacks,
            'month': month_feedbacks,
        },
        'sentiment': {
            'positive': positive_count,
            'negative': negative_count,
            'ratio': round(positive_count / max(positive_count + negative_count, 1) * 100, 1),
        },
        'activity': {
            'active_authors_week': active_authors,
            'active_authors_percent': round(active_authors / max(total_users, 1) * 100, 1),
        },
        'top_tags': top_tags_data,
    })


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_by_user(request):
    """
    GET /api/analytics/by-user/
    GET /api/analytics/by-user/?user_id=<uuid>
    
    Статистика по конкретному пользователю или по всем.
    """
    user_id = request.query_params.get('user_id')
    period_days = int(request.query_params.get('period', 30))

    now = timezone.now()
    period_start = now - timedelta(days=period_days)

    if user_id:
        # Статистика по конкретному пользователю
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(get_user_analytics(user, period_start))

    # Статистика по всем пользователям
    users = User.objects.filter(is_active=True, role='employee').order_by('last_name')

    users_data = []
    for user in users:
        analytics = get_user_analytics(user, period_start)
        users_data.append({
            'user': UserShortSerializer(user).data,
            **analytics,
        })

    return Response({
        'period_days': period_days,
        'users': users_data,
    })


def get_user_analytics(user, period_start):
    """Получить аналитику по пользователю."""
    # Полученные отзывы
    received = Feedback.objects.filter(
        recipient=user,
        created_at__gte=period_start,
    )
    received_total = received.count()

    received_positive = received.filter(tags__sentiment='positive').distinct().count()
    received_negative = received.filter(tags__sentiment='negative').distinct().count()

    # Оставленные отзывы
    given = Feedback.objects.filter(
        author=user,
        created_at__gte=period_start,
    )
    given_total = given.count()

    # Топ тегов (полученных)
    top_received_tags = Tag.objects.filter(
        feedbacks__recipient=user,
        feedbacks__created_at__gte=period_start,
    ).annotate(
        count=Count('feedbacks')
    ).order_by('-count')[:5]

    tags_data = [
        {
            'id': str(tag.id),
            'name': tag.name,
            'icon': tag.icon,
            'color': tag.color,
            'sentiment': tag.sentiment,
            'count': tag.count,
        }
        for tag in top_received_tags
    ]

    # От кого больше всего отзывов
    top_authors = Feedback.objects.filter(
        recipient=user,
        created_at__gte=period_start,
    ).values('author').annotate(
        count=Count('id')
    ).order_by('-count')[:5]

    top_authors_data = []
    for item in top_authors:
        try:
            author = User.objects.get(id=item['author'])
            top_authors_data.append({
                'user': UserShortSerializer(author).data,
                'count': item['count'],
            })
        except User.DoesNotExist:
            pass

    return {
        'received': {
            'total': received_total,
            'positive': received_positive,
            'negative': received_negative,
            'sentiment_score': calculate_sentiment_score(received_positive, received_negative),
        },
        'given': {
            'total': given_total,
        },
        'top_tags': tags_data,
        'top_authors': top_authors_data,
    }


def calculate_sentiment_score(positive, negative):
    """
    Расчёт sentiment score: от -100 до +100.
    """
    total = positive + negative
    if total == 0:
        return 0
    return round((positive - negative) / total * 100, 1)


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_leaderboard(request):
    """
    GET /api/analytics/leaderboard/
    
    Рейтинг сотрудников по различным метрикам.
    """
    period_days = int(request.query_params.get('period', 30))
    limit = int(request.query_params.get('limit', 10))
    metric = request.query_params.get('metric', 'received_positive')

    now = timezone.now()
    period_start = now - timedelta(days=period_days)

    users = User.objects.filter(is_active=True, role='employee')

    leaderboard = []

    for user in users:
        received = Feedback.objects.filter(
            recipient=user,
            created_at__gte=period_start,
        )

        received_positive = received.filter(tags__sentiment='positive').distinct().count()
        received_negative = received.filter(tags__sentiment='negative').distinct().count()
        received_total = received.distinct().count()

        given_total = Feedback.objects.filter(
            author=user,
            created_at__gte=period_start,
        ).count()

        sentiment_score = calculate_sentiment_score(received_positive, received_negative)

        leaderboard.append({
            'user': UserShortSerializer(user).data,
            'metrics': {
                'received_total': received_total,
                'received_positive': received_positive,
                'received_negative': received_negative,
                'given_total': given_total,
                'sentiment_score': sentiment_score,
            },
        })

    # Сортировка по выбранной метрике
    sort_key = {
        'received_positive': lambda x: x['metrics']['received_positive'],
        'received_total': lambda x: x['metrics']['received_total'],
        'given_total': lambda x: x['metrics']['given_total'],
        'sentiment_score': lambda x: x['metrics']['sentiment_score'],
    }.get(metric, lambda x: x['metrics']['received_positive'])

    leaderboard.sort(key=sort_key, reverse=True)

    # Добавляем позицию
    for i, item in enumerate(leaderboard[:limit], 1):
        item['position'] = i

    return Response({
        'period_days': period_days,
        'metric': metric,
        'leaderboard': leaderboard[:limit],
    })


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_trends(request):
    """
    GET /api/analytics/trends/
    
    Тренды отзывов по дням/неделям/месяцам.
    """
    period_days = int(request.query_params.get('period', 30))
    group_by = request.query_params.get('group_by', 'day')  # day, week, month

    now = timezone.now()
    period_start = now - timedelta(days=period_days)

    # Выбор функции группировки
    trunc_func = {
        'day': TruncDate,
        'week': TruncWeek,
        'month': TruncMonth,
    }.get(group_by, TruncDate)

    # Все отзывы
    feedbacks = Feedback.objects.filter(
        created_at__gte=period_start,
    ).annotate(
        period=trunc_func('created_at')
    ).values('period').annotate(
        total=Count('id'),
    ).order_by('period')

    # Позитивные
    positive = Feedback.objects.filter(
        created_at__gte=period_start,
        tags__sentiment='positive',
    ).annotate(
        period=trunc_func('created_at')
    ).values('period').annotate(
        count=Count('id', distinct=True),
    ).order_by('period')

    # Негативные
    negative = Feedback.objects.filter(
        created_at__gte=period_start,
        tags__sentiment='negative',
    ).annotate(
        period=trunc_func('created_at')
    ).values('period').annotate(
        count=Count('id', distinct=True),
    ).order_by('period')

    # Собираем данные
    positive_dict = {str(item['period']): item['count'] for item in positive}
    negative_dict = {str(item['period']): item['count'] for item in negative}

    trends = []
    for item in feedbacks:
        period_str = str(item['period'])
        trends.append({
            'period': period_str,
            'total': item['total'],
            'positive': positive_dict.get(period_str, 0),
            'negative': negative_dict.get(period_str, 0),
        })

    return Response({
        'period_days': period_days,
        'group_by': group_by,
        'trends': trends,
    })


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_sociometry(request):
    """
    GET /api/analytics/sociometry/
    
    Социометрия: граф взаимодействий между сотрудниками.
    Возвращает nodes (пользователи) и edges (связи).
    """
    period_days = int(request.query_params.get('period', 30))
    min_interactions = int(request.query_params.get('min_interactions', 1))

    now = timezone.now()
    period_start = now - timedelta(days=period_days)

    # Узлы — активные сотрудники
    users = User.objects.filter(is_active=True).exclude(role='admin')

    nodes = []
    for user in users:
        received_count = Feedback.objects.filter(
            recipient=user,
            created_at__gte=period_start,
        ).count()

        given_count = Feedback.objects.filter(
            author=user,
            created_at__gte=period_start,
        ).count()

        nodes.append({
            'id': str(user.id),
            'label': user.short_name,
            'full_name': user.full_name,
            'role': user.role,
            'department': user.department,
            'position': user.position,
            'color': user.avatar_color,
            'received': received_count,
            'given': given_count,
            'total': received_count + given_count,
        })

    # Рёбра — взаимодействия между пользователями
    edges_data = Feedback.objects.filter(
        created_at__gte=period_start,
    ).values(
        'author', 'recipient'
    ).annotate(
        count=Count('id'),
        positive=Count('id', filter=Q(tags__sentiment='positive')),
        negative=Count('id', filter=Q(tags__sentiment='negative')),
    ).filter(count__gte=min_interactions)

    edges = []
    for edge in edges_data:
        # Определяем тональность связи
        if edge['positive'] > edge['negative']:
            sentiment = 'positive'
            color = '#52c41a'
        elif edge['negative'] > edge['positive']:
            sentiment = 'negative'
            color = '#ff4d4f'
        else:
            sentiment = 'neutral'
            color = '#1890ff'

        edges.append({
            'source': str(edge['author']),
            'target': str(edge['recipient']),
            'count': edge['count'],
            'positive': edge['positive'],
            'negative': edge['negative'],
            'sentiment': sentiment,
            'color': color,
            'weight': min(edge['count'], 10),  # Для толщины линии
        })

    # Статистика графа
    stats = {
        'nodes_count': len(nodes),
        'edges_count': len(edges),
        'total_interactions': sum(e['count'] for e in edges),
        'density': round(len(edges) / max(len(nodes) * (len(nodes) - 1), 1) * 100, 2),
    }

    return Response({
        'period_days': period_days,
        'min_interactions': min_interactions,
        'nodes': nodes,
        'edges': edges,
        'stats': stats,
    })


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_tags(request):
    """
    GET /api/analytics/tags/
    
    Аналитика по тегам: использование, тренды.
    """
    period_days = int(request.query_params.get('period', 30))

    now = timezone.now()
    period_start = now - timedelta(days=period_days)

    # Статистика по каждому тегу
    tags = Tag.objects.filter(is_active=True).annotate(
        total_usage=Count('feedbacks'),
        period_usage=Count(
            'feedbacks',
            filter=Q(feedbacks__created_at__gte=period_start)
        ),
    ).order_by('-period_usage')

    tags_data = []
    for tag in tags:
        tags_data.append({
            'id': str(tag.id),
            'name': tag.name,
            'slug': tag.slug,
            'icon': tag.icon,
            'color': tag.color,
            'sentiment': tag.sentiment,
            'total_usage': tag.total_usage,
            'period_usage': tag.period_usage,
        })

    # Группировка по sentiment
    positive_total = sum(t['period_usage'] for t in tags_data if t['sentiment'] == 'positive')
    negative_total = sum(t['period_usage'] for t in tags_data if t['sentiment'] == 'negative')

    return Response({
        'period_days': period_days,
        'tags': tags_data,
        'summary': {
            'positive_usage': positive_total,
            'negative_usage': negative_total,
            'total_usage': positive_total + negative_total,
        },
    })


@api_view(['GET'])
@permission_classes([IsManager])
def analytics_export(request):
    """
    GET /api/analytics/export/
    GET /api/analytics/export/?type=feedbacks&period=30
    GET /api/analytics/export/?type=users&period=30
    GET /api/analytics/export/?type=summary&period=30
    
    Экспорт аналитики в Excel.
    """
    export_type = request.query_params.get('type', 'feedbacks')
    period_days = int(request.query_params.get('period', 30))

    exporter = ExcelExporter()

    try:
        if export_type == 'feedbacks':
            return exporter.export_feedbacks(period_days)
        elif export_type == 'users':
            return exporter.export_users_analytics(period_days)
        elif export_type == 'summary':
            return exporter.export_summary(period_days)
        elif export_type == 'full':
            return exporter.export_full_report(period_days)
        else:
            return Response(
                {'detail': f'Неизвестный тип экспорта: {export_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    except Exception as e:
        logger.error(f'Export error: {e}')
        return Response(
            {'detail': f'Ошибка экспорта: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )