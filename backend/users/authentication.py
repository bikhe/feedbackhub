import hashlib
import hmac
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class TokenAuthentication(BaseAuthentication):
    """
    Простая токен-аутентификация.
    Токен передаётся в заголовке: Authorization: Token <token>
    """
    keyword = 'Token'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if not auth_header:
            return None

        parts = auth_header.split()

        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        token = parts[1]

        try:
            from users.models import AuthToken
            auth_token = AuthToken.objects.select_related('user').get(key=token)
        except Exception:
            raise AuthenticationFailed('Недействительный токен.')

        if not auth_token.user.is_active:
            raise AuthenticationFailed('Пользователь деактивирован.')

        if auth_token.is_expired():
            auth_token.delete()
            raise AuthenticationFailed('Токен истёк. Войдите заново.')

        # Обновляем время последнего использования
        auth_token.last_used = timezone.now()
        auth_token.save(update_fields=['last_used'])

        return (auth_token.user, auth_token)

    def authenticate_header(self, request):
        return self.keyword