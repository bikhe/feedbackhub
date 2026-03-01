from rest_framework import serializers
from .models import User


class UserShortSerializer(serializers.ModelSerializer):
    """Краткая информация о пользователе (для списков, select)."""

    full_name = serializers.CharField(read_only=True)
    short_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'short_name',
            'initials',
            'role',
            'position',
            'department',
            'avatar_color',
        ]


class UserDetailSerializer(serializers.ModelSerializer):
    """Полная информация о пользователе."""

    full_name = serializers.CharField(read_only=True)
    short_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    is_manager = serializers.BooleanField(read_only=True)
    is_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'patronymic',
            'full_name',
            'short_name',
            'initials',
            'role',
            'position',
            'department',
            'avatar_color',
            'is_active',
            'is_manager',
            'is_admin',
            'date_joined',
            'last_login',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    """Создание пользователя (только admin)."""

    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'password',
            'first_name',
            'last_name',
            'patronymic',
            'role',
            'position',
            'department',
            'avatar_color',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        if user.role == 'admin':
            user.is_staff = True
            user.is_superuser = True
        elif user.role == 'manager':
            user.is_staff = True
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Обновление пользователя."""

    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'patronymic',
            'role',
            'position',
            'department',
            'avatar_color',
            'is_active',
        ]

    def update(self, instance, validated_data):
        role = validated_data.get('role', instance.role)
        if role == 'admin':
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = True
        elif role == 'manager':
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = False
        else:
            validated_data['is_staff'] = False
            validated_data['is_superuser'] = False
        return super().update(instance, validated_data)


class LoginSerializer(serializers.Serializer):
    """Сериализатор для входа."""

    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password', '')

        if not email or not password:
            raise serializers.ValidationError('Email и пароль обязательны.')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Неверный email или пароль.')

        if not user.check_password(password):
            raise serializers.ValidationError('Неверный email или пароль.')

        if not user.is_active:
            raise serializers.ValidationError('Учётная запись деактивирована.')

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """Смена пароля."""

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Текущий пароль неверный.')
        return value