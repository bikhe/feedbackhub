import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Button, Table, Space, Tag, Avatar, Modal, Form,
  Input, Select, Switch, InputNumber, Tabs, Popconfirm, message, Badge, Tooltip, DatePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, TagOutlined, ProjectOutlined,
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, UserAddOutlined,
} from '@ant-design/icons';
import { tagsApi } from '../api/feedback';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import { Tag as TagType, TagCreatePayload, TaskListItem, UserShort, UserCreatePayload } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');
const { Title, Text } = Typography;

const PRESET_COLORS = ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#f44336', '#E91E63', '#9C27B0', '#FF5722', '#795548', '#1890ff', '#13c2c2', '#722ed1', '#fa8c16', '#52c41a'];
const PRESET_ICONS = ['🎓', '💡', '📋', '😊', '⏰', '🚫', '❌', '🏃', '⏳', '😤', '👍', '👎', '🌟', '🔥', '💪', '🤝', '📈', '📉', '⚡', '🎯'];

const TagsSection: React.FC = () => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form] = Form.useForm();

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    try { const res = await tagsApi.list(); setTags(res); } catch { message.error('Ошибка загрузки тегов'); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  const openModal = (tag?: TagType) => {
    setEditingTag(tag || null);
    if (tag) form.setFieldsValue({ name: tag.name, sentiment: tag.sentiment, icon: tag.icon, color: tag.color, description: tag.description, sort_order: tag.sort_order, is_active: tag.is_active });
    else { form.resetFields(); form.setFieldsValue({ sentiment: 'positive', icon: '👍', color: '#4CAF50', sort_order: 0, is_active: true }); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      if (editingTag) { await tagsApi.update(editingTag.id, values); message.success('Тег обновлён'); }
      else { await tagsApi.create(values as TagCreatePayload); message.success('Тег создан'); }
      setModalOpen(false); loadTags();
    } catch (err: any) { const data = err?.response?.data; const msg = data?.name?.[0] || data?.detail || 'Ошибка сохранения'; message.error(msg); } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => { try { await tagsApi.remove(id); message.success('Тег удалён'); loadTags(); } catch { message.error('Ошибка удаления'); } };
  const handleToggleActive = async (tag: TagType) => { try { await tagsApi.update(tag.id, { is_active: !tag.is_active }); message.success(tag.is_active ? 'Тег деактивирован' : 'Тег активирован'); loadTags(); } catch { message.error('Ошибка обновления'); } };

  const columns = [
    { title: 'Тег', key: 'tag', render: (_: any, r: TagType) => <Space size={10}><div style={{ width: 36, height: 36, borderRadius: 8, background: r.color + '20', border: `2px solid ${r.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{r.icon}</div><div><Text strong style={{ color: r.is_active ? r.color : '#bfbfbf', fontSize: 13 }}>{r.name}</Text>{r.description && <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{r.description}</div>}</div></Space> },
    { title: 'Тональность', dataIndex: 'sentiment', key: 'sentiment', width: 130, filters: [{ text: 'Позитивный', value: 'positive' }, { text: 'Негативный', value: 'negative' }], onFilter: (v: any, r: TagType) => r.sentiment === v, render: (v: string) => <Tag color={v === 'positive' ? 'success' : 'error'}>{v === 'positive' ? '✅ Позитивный' : '❌ Негативный'}</Tag> },
    { title: 'Использований', dataIndex: 'feedback_count', key: 'fc', width: 120, sorter: (a: TagType, b: TagType) => a.feedback_count - b.feedback_count, render: (v: number) => <Badge count={v} showZero style={{ backgroundColor: v > 0 ? '#1890ff' : '#d9d9d9' }} overflowCount={999} /> },
    { title: 'Порядок', dataIndex: 'sort_order', key: 'so', width: 90, sorter: (a: TagType, b: TagType) => a.sort_order - b.sort_order, render: (v: number) => <Text type="secondary" style={{ fontSize: 13 }}>{v}</Text> },
    { title: 'Активен', key: 'is_active', width: 90, filters: [{ text: 'Активные', value: true }, { text: 'Неактивные', value: false }], onFilter: (v: any, r: TagType) => r.is_active === v, render: (_: any, r: TagType) => <Switch checked={r.is_active} onChange={() => handleToggleActive(r)} size="small" /> },
    { title: 'Действия', key: 'actions', width: 100, render: (_: any, r: TagType) => <Space size={4}><Tooltip title="Редактировать"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => openModal(r)} /></Tooltip><Tooltip title="Удалить"><Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)} okButtonProps={{ danger: true }}><Button type="text" icon={<DeleteOutlined />} size="small" danger disabled={r.feedback_count > 0} /></Popconfirm></Tooltip></Space> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><Space><Text strong>Теги обратной связи</Text><Badge count={tags.length} style={{ backgroundColor: '#1890ff' }} /></Space><Space><Button icon={<ReloadOutlined />} onClick={loadTags} loading={isLoading} /><Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Новый тег</Button></Space></div>
      <Table dataSource={tags} columns={columns} rowKey="id" loading={isLoading} size="middle" pagination={{ pageSize: 15 }} rowClassName={(r) => (!r.is_active ? 'tag-row-inactive' : '')} />
      <Modal title={editingTag ? 'Редактировать тег' : 'Новый тег'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={isSaving} width={520}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sentiment" label="Тональность" rules={[{ required: true }]}><Select options={[{ value: 'positive', label: '✅ Позитивный' }, { value: 'negative', label: '❌ Негативный' }]} /></Form.Item>
          <Form.Item name="icon" label="Иконка (emoji)"><Input style={{ width: 100 }} /></Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>{PRESET_ICONS.map((ico) => <button key={ico} type="button" onClick={() => form.setFieldValue('icon', ico)} style={{ fontSize: 22, border: '1px solid #e8e8e8', borderRadius: 6, background: 'white', cursor: 'pointer' }}>{ico}</button>)}</div>
          <Form.Item name="color" label="Цвет"><Input style={{ width: 120 }} /></Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>{PRESET_COLORS.map((col) => <button key={col} type="button" onClick={() => form.setFieldValue('color', col)} style={{ width: 28, height: 28, borderRadius: 6, background: col, border: '2px solid white', outline: '1px solid #e8e8e8', cursor: 'pointer' }} />)}</div>
          <Form.Item name="description" label="Описание"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}><Col span={12}><Form.Item name="sort_order" label="Порядок"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="is_active" label="Активен" valuePropName="checked"><Switch /></Form.Item></Col></Row>
        </Form>
      </Modal>
      <style>{`.tag-row-inactive { opacity: 0.5; }`}</style>
    </div>
  );
};

const TasksSection: React.FC = () => {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskListItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<UserShort[]>([]);
  const [form] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadTasks = useCallback(async () => { setIsLoading(true); try { const res = await tasksApi.list({ page }); setTasks(res.results); setTotal(res.count); } catch { message.error('Ошибка загрузки задач'); } finally { setIsLoading(false); } }, [page]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { usersApi.list({ is_active: true }).then((res) => setUsers(res.results)).catch(console.error); }, []);

  const openModal = (task?: TaskListItem) => {
    setEditingTask(task || null);
    if (task) form.setFieldsValue({ title: task.title, code: task.code, status: task.status, priority: task.priority, deadline: task.deadline ? dayjs(task.deadline) : null });
    else { form.resetFields(); form.setFieldsValue({ status: 'active', priority: 'medium' }); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      const payload = { ...values, deadline: values.deadline ? dayjs(values.deadline).format('YYYY-MM-DD') : null, assignee_ids: values.assignee_ids || [] };
      if (editingTask) { await tasksApi.update(editingTask.id, payload); message.success('Задача обновлена'); }
      else { await tasksApi.create(payload); message.success('Задача создана'); }
      setModalOpen(false); loadTasks();
    } catch (err: any) { const msg = err?.response?.data?.detail || 'Ошибка сохранения'; message.error(msg); } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => { try { await tasksApi.remove(id); message.success('Задача удалена'); loadTasks(); } catch { message.error('Ошибка удаления'); } };

  const columns = [
    { title: 'Название', dataIndex: 'title', key: 'title', render: (v: string, r: TaskListItem) => <div><Text strong style={{ fontSize: 13 }}>{v}</Text>{r.is_overdue && <Tag color="red" style={{ marginLeft: 6 }}>Просрочена</Tag>}</div> },
    { title: 'Статус', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => <Badge status={v === 'active' ? 'processing' : v === 'completed' ? 'success' : 'default'} text={v} /> },
    { title: 'Приоритет', dataIndex: 'priority', key: 'priority', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Отзывов', dataIndex: 'feedback_count', key: 'fc', width: 90, render: (v: number) => <Badge count={v} showZero style={{ backgroundColor: v > 0 ? '#1890ff' : '#d9d9d9' }} /> },
    { title: 'Действия', key: 'actions', width: 90, render: (_: any, r: TaskListItem) => <Space size={4}><Tooltip title="Редактировать"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => openModal(r)} /></Tooltip><Tooltip title="Удалить"><Popconfirm title="Удалить?" onConfirm={() => handleDelete(r.id)} okButtonProps={{ danger: true }}><Button type="text" icon={<DeleteOutlined />} size="small" danger /></Popconfirm></Tooltip></Space> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><Space><Text strong>Задачи</Text><Badge count={total} style={{ backgroundColor: '#1890ff' }} /></Space><Space><Button icon={<ReloadOutlined />} onClick={loadTasks} loading={isLoading} /><Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Новая задача</Button></Space></div>
      <Table dataSource={tasks} columns={columns} rowKey="id" loading={isLoading} size="middle" scroll={{ x: 800 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      <Modal title={editingTask ? 'Редактировать задачу' : 'Новая задача'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={isSaving} width={560}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Код"><Input style={{ width: 160 }} placeholder="Уникальный код" /></Form.Item>
          <Form.Item name="description" label="Описание"><Input.TextArea rows={3} /></Form.Item>
          <Row gutter={16}><Col span={12}><Form.Item name="status" label="Статус"><Select options={[{ value: 'active', label: 'Активна' }, { value: 'completed', label: 'Завершена' }]} /></Form.Item></Col><Col span={12}><Form.Item name="priority" label="Приоритет"><Select options={[{ value: 'medium', label: 'Средний' }, { value: 'high', label: 'Высокий' }]} /></Form.Item></Col></Row>
          <Form.Item name="assignee_ids" label="Исполнители"><Select mode="multiple" options={users.map((u) => ({ value: u.id, label: u.full_name }))} /></Form.Item>
          <Form.Item name="deadline" label="Дедлайн"><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const UsersSection: React.FC = () => {
  const [users, setUsers] = useState<UserShort[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserShort | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadUsers = useCallback(async () => { setIsLoading(true); try { const res = await usersApi.list({ page }); setUsers(res.results); setTotal(res.count); } catch { message.error('Ошибка загрузки'); } finally { setIsLoading(false); } }, [page]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openModal = (user?: UserShort) => {
    setEditingUser(user || null);
    if (user) form.setFieldsValue({ first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, position: user.position, department: user.department, is_active: (user as any).is_active ?? true });
    else { form.resetFields(); form.setFieldsValue({ role: 'employee', is_active: true, avatar_color: '#1890ff' }); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      if (editingUser) { await usersApi.update(editingUser.id, values); message.success('Пользователь обновлён'); }
      else { await usersApi.create(values as UserCreatePayload); message.success('Пользователь создан'); }
      setModalOpen(false); loadUsers();
    } catch (err: any) { message.error(err?.response?.data?.detail || 'Ошибка сохранения'); } finally { setIsSaving(false); }
  };

  const handleDeactivate = async (id: string) => { try { await usersApi.deactivate(id); message.success('Деактивирован'); loadUsers(); } catch { message.error('Ошибка'); } };

  const columns = [
    { title: 'Пользователь', key: 'user', render: (_: any, r: UserShort) => <Space size={10}><Avatar size={38} style={{ backgroundColor: r.avatar_color }}>{r.initials}</Avatar><div><Text strong style={{ fontSize: 13 }}>{r.full_name}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Text></div></Space> },
    { title: 'Роль', dataIndex: 'role', key: 'role', width: 130, render: (v: string) => <Tag color={v === 'admin' ? 'red' : v === 'manager' ? 'green' : 'blue'}>{v}</Tag> },
    { title: 'Должность', dataIndex: 'position', key: 'position' },
    { title: 'Действия', key: 'actions', width: 100, render: (_: any, r: UserShort) => <Space size={4}><Tooltip title="Редактировать"><Button type="text" icon={<EditOutlined />} size="small" onClick={() => openModal(r)} /></Tooltip><Tooltip title="Деактивировать"><Popconfirm title="Деактивировать?" onConfirm={() => handleDeactivate(r.id)} okButtonProps={{ danger: true }}><Button type="text" icon={<DeleteOutlined />} size="small" danger /></Popconfirm></Tooltip></Space> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><Space><Text strong>Пользователи</Text><Badge count={total} style={{ backgroundColor: '#1890ff' }} /></Space><Space><Button icon={<ReloadOutlined />} onClick={loadUsers} loading={isLoading} /><Button type="primary" icon={<UserAddOutlined />} onClick={() => openModal()}>Новый пользователь</Button></Space></div>
      <Table dataSource={users} columns={columns} rowKey="id" loading={isLoading} size="middle" scroll={{ x: 700 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      <Modal title={editingUser ? 'Редактировать' : 'Новый пользователь'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={isSaving} width={520}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}><Col span={12}><Form.Item name="last_name" label="Фамилия" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="first_name" label="Имя" rules={[{ required: true }]}><Input /></Form.Item></Col></Row>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input disabled={!!editingUser} /></Form.Item>
          {!editingUser && <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>}
          <Row gutter={16}><Col span={12}><Form.Item name="role" label="Роль"><Select options={[{ value: 'employee', label: 'Сотрудник' }, { value: 'manager', label: 'Руководитель' }, { value: 'admin', label: 'Администратор' }]} /></Form.Item></Col><Col span={12}><Form.Item name="is_active" label="Активен" valuePropName="checked"><Switch /></Form.Item></Col></Row>
        </Form>
      </Modal>
    </div>
  );
};

const AdminPage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: 24 }}><Title level={3} style={{ margin: 0 }}>Управление</Title><Text type="secondary">Теги, задачи и пользователи системы</Text></div>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: '0 0 24px' }}>
        <Tabs defaultActiveKey="tags" style={{ padding: '0 24px' }} size="large" items={[
          { key: 'tags', label: <Space><TagOutlined />Теги</Space>, children: <TagsSection /> },
          { key: 'tasks', label: <Space><ProjectOutlined />Задачи</Space>, children: <TasksSection /> },
          { key: 'users', label: <Space><TeamOutlined />Пользователи</Space>, children: <UsersSection /> },
        ]} />
      </Card>
    </div>
  );
};

export default AdminPage;