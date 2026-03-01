-- ============================================
-- FeedbackHub: Инициализация базы данных
-- ============================================

-- Расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Расширение для триграмм (поиск по тексту)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Настройки для русской локали
SET client_encoding = 'UTF8';

-- ============================================
-- Гранты (на случай другого пользователя)
-- ============================================
GRANT ALL PRIVILEGES ON DATABASE feedbackhub TO feedbackhub_user;

-- ============================================
-- Информационное сообщение
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ FeedbackHub database initialized successfully';
    RAISE NOTICE '   Database: feedbackhub';
    RAISE NOTICE '   User: feedbackhub_user';
    RAISE NOTICE '   Extensions: uuid-ossp, pg_trgm';
END
$$;