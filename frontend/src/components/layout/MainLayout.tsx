import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Space, Button, theme, MenuProps } from 'antd';
import {
  DashboardOutlined, PlusCircleOutlined, BarChartOutlined, FileTextOutlined,
  SettingOutlined, LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const isManager = user?.is_manager || false;

  const menuItems: MenuProps['items'] = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Дашборд' },
    { key: '/feedback/new', icon: <PlusCircleOutlined />, label: 'Оставить отзыв' },
    ...(isManager
      ? [
          { type: 'divider' as const },
          {
            key: 'manager-group',
            type: 'group' as const,
            label: 'Менеджер',
            children: [
              { key: '/analytics', icon: <BarChartOutlined />, label: 'Аналитика' },
              { key: '/reports', icon: <FileTextOutlined />, label: 'Отчёты' },
              { key: '/admin', icon: <SettingOutlined />, label: 'Управление' },
            ],
          },
        ]
      : []),
  ];

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: (<div><div style={{ fontWeight: 600 }}>{user?.full_name}</div><div style={{ fontSize: 12, color: '#8c8c8c' }}>{user?.email}</div></div>), disabled: true },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true, onClick: async () => { await logout(); navigate('/login'); } },
  ];

  const roleLabel: Record<string, string> = { employee: 'Сотрудник', manager: 'Руководитель', admin: 'Администратор' };
  const roleColor: Record<string, string> = { employee: '#1890ff', manager: '#52c41a', admin: '#f5222d' };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} width={240} style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}`, boxShadow: '2px 0 8px rgba(0,0,0,0.06)', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100, overflow: 'auto' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '0' : '0 20px', borderBottom: `1px solid ${token.colorBorderSecondary}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => navigate('/dashboard')}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1890ff, #096dd9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>F</div>
          {!collapsed && <Text strong style={{ marginLeft: 10, fontSize: 16, color: token.colorTextHeading, whiteSpace: 'nowrap' }}>FeedbackHub</Text>}
        </div>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ border: 'none', padding: '8px 0' }} />
        {!collapsed && user && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}><Space><Avatar style={{ backgroundColor: user.avatar_color, flexShrink: 0 }} size={36}>{user.initials}</Avatar><div style={{ overflow: 'hidden' }}><div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{user.short_name}</div><div style={{ fontSize: 11, color: roleColor[user.role] || '#8c8c8c', fontWeight: 500 }}>{roleLabel[user.role]}</div></div></Space></div>}
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{ padding: '0 24px', background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 18, width: 40, height: 40 }} />
          <Space size={8}>
            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/feedback/new')} size="middle">Оставить отзыв</Button>
            <Badge count={0} size="small"><Button type="text" icon={<BellOutlined />} style={{ fontSize: 18, width: 40, height: 40 }} /></Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}><Avatar style={{ backgroundColor: user?.avatar_color || '#1890ff', cursor: 'pointer', border: '2px solid #e8e8e8' }} size={36}>{user?.initials}</Avatar></Dropdown>
          </Space>
        </Header>
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)', background: '#f0f2f5' }}><Outlet /></Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;