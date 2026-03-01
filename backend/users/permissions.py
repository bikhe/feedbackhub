from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Доступ только для администраторов."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsManager(BasePermission):
    """Доступ для менеджеров и администраторов."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('manager', 'admin')
        )


class IsManagerOrReadOnly(BasePermission):
    """
    Менеджеры и админы — полный доступ.
    Остальные — только чтение.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        return request.user.role in ('manager', 'admin')


class IsOwnerOrManager(BasePermission):
    """
    Владелец объекта или менеджер/админ.
    Объект должен иметь поле user или author.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.role in ('manager', 'admin'):
            return True

        owner = getattr(obj, 'user', None) or getattr(obj, 'author', None)
        return owner == request.user


class IsSelfOrAdmin(BasePermission):
    """Доступ к своему профилю или админ."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj == request.user