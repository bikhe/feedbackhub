from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'feedback'

router = DefaultRouter()
router.register('tags', views.TagViewSet, basename='tag')
router.register('feedback', views.FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('', include(router.urls)),
]