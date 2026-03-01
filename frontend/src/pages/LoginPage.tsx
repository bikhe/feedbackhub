import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginPayload } from '../types';

const { Title, Text } = Typography;

const TEST_ACCOUNTS = [
  { label: 'Руководитель', email: 'manager@example.com', password: 'manager123', color: '#52c41a' },
  { label: 'Сотрудник 1', email: 'employee1@example.com', password: 'employee123', color: '#1890ff' },
  { label: 'Сотрудник 2', email: 'employee2@example.com', password: 'employee123', color: '#1890ff' },
  { label: 'Администратор', email: 'admin@example.com', password: 'admin123', color: '#f5222d' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginPayload>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginPayload) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(values);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.non_field_errors?.[0] || err?.response?.data?.detail || err?.response?.data?.email?.[0] || 'Неверный email или пароль';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (email: string, password: string) => {
    form.setFieldsValue({ email, password });
    form.submit();
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f2f5 50%, #e6fffb 100%)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(24, 144, 255, 0.3)',
          }}>
            <span style={{ fontSize: 32, color: 'white', fontWeight: 700 }}>F</span>
          </div>
          <Title level={2} style={{ margin: 0, color: '#1a1a2e' }}>FeedbackHub</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>Система обратной связи</Text>
        </div>

        <Card style={{ borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: 'none' }} bodyStyle={{ padding: '32px' }}>
          <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>Вход в систему</Title>

          {error && (
            <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 20, borderRadius: 8 }} />
          )}

          <Form form={form} onFinish={handleSubmit} layout="vertical" size="large" requiredMark={false}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}>
              <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="your@email.com" autoComplete="email" autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]} style={{ marginBottom: 24 }}>
              <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={isLoading} icon={<LoginOutlined />}
              style={{ height: 44, fontSize: 15, fontWeight: 600, borderRadius: 8 }}>
              Войти
            </Button>
          </Form>

          <Divider style={{ margin: '24px 0 16px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Быстрый вход (демо)</Text>
          </Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TEST_ACCOUNTS.map((acc) => (
              <Button key={acc.email} size="small" onClick={() => handleQuickLogin(acc.email, acc.password)} disabled={isLoading}
                style={{ borderRadius: 8, borderColor: acc.color, color: acc.color, fontSize: 12, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: acc.color, display: 'inline-block', flexShrink: 0 }} />
                {acc.label}
              </Button>
            ))}
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>Нажмите на кнопку демо-аккаунта для быстрого входа</Text>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;