import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Select, Input, Button, Typography, Space, Alert, Switch, Steps,
  Avatar, Tag, Divider, Row, Col, Spin, Result, Tooltip, Progress,
} from 'antd';
import {
  UserOutlined, CheckCircleOutlined, SendOutlined, ArrowLeftOutlined,
  ArrowRightOutlined, InfoCircleOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { feedbackApi, tagsApi } from '../api/feedback';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import { UserShort, TaskSelect, TagShort, TagGrouped, FeedbackLimits } from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const MIN_COMMENT_LENGTH = 10;
const MAX_TAGS = 3;
const MIN_TAGS = 1;

const TagButton: React.FC<{ tag: TagShort; selected: boolean; disabled: boolean; onClick: () => void }> = ({ tag, selected, disabled, onClick }) => (
  <Tooltip title={disabled && !selected ? `Максимум ${MAX_TAGS} тега` : ''}>
    <button onClick={onClick} disabled={disabled && !selected} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
      border: `2px solid ${selected ? tag.color : '#e8e8e8'}`, background: selected ? tag.color + '15' : 'white',
      cursor: disabled && !selected ? 'not-allowed' : 'pointer', opacity: disabled && !selected ? 0.5 : 1,
      transition: 'all 0.2s', width: '100%', textAlign: 'left', boxShadow: selected ? `0 2px 8px ${tag.color}30` : 'none',
    }}>
      <span style={{ fontSize: 20 }}>{tag.icon}</span>
      <span style={{ fontWeight: selected ? 600 : 400, color: selected ? tag.color : '#333', fontSize: 13 }}>{tag.name}</span>
      {selected && <CheckCircleOutlined style={{ color: tag.color, marginLeft: 'auto', fontSize: 16 }} />}
    </button>
  </Tooltip>
);

const FeedbackPreview: React.FC<{
  recipient: UserShort | null; task: TaskSelect | null; selectedTags: TagShort[]; comment: string; isAnonymous: boolean;
}> = ({ recipient, task, selectedTags, comment, isAnonymous }) => {
  const sentiment = selectedTags[0]?.sentiment;
  const borderColor = sentiment === 'positive' ? '#52c41a' : sentiment === 'negative' ? '#ff4d4f' : '#d9d9d9';
  const bgColor = sentiment === 'positive' ? '#f6ffed' : sentiment === 'negative' ? '#fff2f0' : '#fafafa';

  return (
    <Card style={{ borderRadius: 12, borderLeft: `4px solid ${borderColor}`, background: bgColor }} bodyStyle={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}><Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр отзыва</Text></div>
      {recipient && <Space style={{ marginBottom: 12 }}><Avatar style={{ backgroundColor: recipient.avatar_color }} size={40}>{recipient.initials}</Avatar><div><div style={{ fontWeight: 600 }}>{recipient.full_name}</div><Text type="secondary" style={{ fontSize: 12 }}>{recipient.position}</Text></div></Space>}
      {task && <div style={{ marginBottom: 10 }}><Text style={{ fontSize: 13 }}>{task.title}</Text></div>}
      {selectedTags.length > 0 && <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{selectedTags.map((tag) => <span key={tag.id} style={{ background: tag.color + '20', border: `1px solid ${tag.color}60`, color: tag.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>{tag.icon} {tag.name}</span>)}</div>}
      {comment && <Paragraph style={{ fontSize: 13, color: '#595959', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '10px 12px', margin: 0, fontStyle: 'italic' }}>"{comment}"</Paragraph>}
      {isAnonymous && <div style={{ marginTop: 10 }}><Tag icon={<EyeInvisibleOutlined />} color="default">Анонимный отзыв</Tag></div>}
    </Card>
  );
};

const FeedbackFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<UserShort[]>([]);
  const [tasks, setTasks] = useState<TaskSelect[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGrouped>({ positive: [], negative: [] });
  const [limits, setLimits] = useState<FeedbackLimits | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<'positive' | 'negative' | null>(null);

  const selectedColleague = colleagues.find((c) => c.id === selectedColleagueId) || null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const allTags = [...tagGroups.positive, ...tagGroups.negative];
  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const canAddMoreTags = selectedTagIds.length < MAX_TAGS;

  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      try {
        const [colleaguesRes, tagsRes, limitsRes] = await Promise.all([usersApi.colleagues(), tagsApi.grouped(), feedbackApi.limits()]);
        setColleagues(colleaguesRes); setTagGroups(tagsRes); setLimits(limitsRes);
      } catch (err) { console.error('Load error:', err); }
      finally { setDataLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedColleagueId) { setTasks([]); setSelectedTaskId(null); return; }
    const loadTasks = async () => {
      try { const res = await tasksApi.forFeedback(selectedColleagueId); setTasks(res); }
      catch { try { const res = await tasksApi.active(); setTasks(res); } catch { setTasks([]); } }
    };
    loadTasks();
  }, [selectedColleagueId]);

  const handleTagClick = useCallback((tag: TagShort) => {
    const isSelected = selectedTagIds.includes(tag.id);
    if (isSelected) { const newIds = selectedTagIds.filter((id) => id !== tag.id); setSelectedTagIds(newIds); if (newIds.length === 0) setSentimentFilter(null); return; }
    if (sentimentFilter && tag.sentiment !== sentimentFilter) return;
    if (!canAddMoreTags) return;
    setSelectedTagIds([...selectedTagIds, tag.id]); setSentimentFilter(tag.sentiment);
  }, [selectedTagIds, sentimentFilter, canAddMoreTags]);

  const isStep0Valid = !!selectedColleagueId && !!selectedTaskId;
  const isStep1Valid = selectedTagIds.length >= MIN_TAGS;
  const isStep2Valid = comment.trim().length >= MIN_COMMENT_LENGTH;

  const handleSubmit = async () => {
    if (!selectedColleagueId || !selectedTaskId || selectedTagIds.length === 0) return;
    setIsLoading(true); setSubmitError(null);
    try {
      await feedbackApi.create({ recipient_id: selectedColleagueId, task_id: selectedTaskId, tag_ids: selectedTagIds, comment: comment.trim(), is_anonymous: isAnonymous });
      setIsSubmitted(true);
    } catch (err: any) {
      const data = err?.response?.data;
      setSubmitError(data?.detail || data?.non_field_errors?.[0] || data?.comment?.[0] || data?.tag_ids?.[0] || 'Ошибка при отправке отзыва');
    } finally { setIsLoading(false); }
  };

  if (isSubmitted) return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Result status="success" title="Отзыв отправлен!" subTitle={`Ваш отзыв для ${selectedColleague?.full_name} успешно отправлен.`} extra={[
        <Button type="primary" key="new" onClick={() => { setIsSubmitted(false); setCurrentStep(0); setSelectedColleagueId(null); setSelectedTaskId(null); setSelectedTagIds([]); setComment(''); setIsAnonymous(false); setSentimentFilter(null); }}>Оставить ещё отзыв</Button>,
        <Button key="dashboard" onClick={() => navigate('/dashboard')}>На дашборд</Button>,
      ]} />
    </div>
  );

  if (dataLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;

  if (limits && limits.today.remaining === 0) return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Result status="warning" title="Дневной лимит исчерпан" subTitle={`Вы использовали все ${limits.today.limit} отзывов на сегодня.`} extra={<Button type="primary" onClick={() => navigate('/dashboard')}>На дашборд</Button>} />
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')} style={{ marginBottom: 8, padding: 0 }}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>Оставить отзыв</Title>
        <Text type="secondary">Помогите коллегам стать лучше — оставьте честный отзыв</Text>
      </div>

      {limits && <Alert message={<Space split={<Divider type="vertical" />}><span>Сегодня: <strong style={{ color: limits.today.remaining > 0 ? '#52c41a' : '#ff4d4f' }}>{limits.today.remaining}/{limits.today.limit}</strong></span><span>Неделя: <strong>{limits.week.remaining}/{limits.week.limit}</strong></span></Space>} type="info" showIcon style={{ marginBottom: 20, borderRadius: 10 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 24 }}>
            <Steps current={currentStep} size="small" style={{ marginBottom: 28 }} items={[{ title: 'Кому', icon: <UserOutlined /> }, { title: 'Теги' }, { title: 'Комментарий' }]} />

            {currentStep === 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size={20}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Выберите коллегу *</Text>
                  <Select showSearch style={{ width: '100%' }} placeholder="Начните вводить имя..." value={selectedColleagueId}
                    onChange={(val) => { setSelectedColleagueId(val); setSelectedTaskId(null); }}
                    filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                    options={colleagues.map((c) => ({ value: c.id, label: c.full_name }))}
                    optionRender={(option) => { const c = colleagues.find((u) => u.id === option.value); if (!c) return option.label; return <Space><Avatar size={28} style={{ backgroundColor: c.avatar_color }}>{c.initials}</Avatar><div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.full_name}</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>{c.position || c.department}</div></div></Space>; }}
                    size="large"
                  />
                </div>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>Выберите задачу *</Text>
                  <Select style={{ width: '100%' }} placeholder={selectedColleagueId ? 'Выберите задачу...' : 'Сначала выберите коллегу'} value={selectedTaskId} onChange={setSelectedTaskId} disabled={!selectedColleagueId}
                    options={tasks.map((t) => ({ value: t.id, label: t.title }))}
                    notFoundContent={selectedColleagueId ? <Text type="secondary">Нет доступных задач</Text> : null} size="large"
                  />
                </div>
              </Space>
            )}

            {currentStep === 1 && (
              <div>
                <div style={{ marginBottom: 16 }}><Text strong>Выберите теги (1–3) *</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>Теги должны быть одной тональности</Text></div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12 }}>Выбрано: {selectedTagIds.length}/{MAX_TAGS}</Text>
                    {sentimentFilter && <Tag color={sentimentFilter === 'positive' ? 'success' : 'error'}>{sentimentFilter === 'positive' ? '✅ Позитивные' : '❌ Негативные'}</Tag>}
                  </div>
                  <Progress percent={(selectedTagIds.length / MAX_TAGS) * 100} showInfo={false} strokeColor={sentimentFilter === 'positive' ? '#52c41a' : sentimentFilter === 'negative' ? '#ff4d4f' : '#1890ff'} size="small" />
                </div>
                {(!sentimentFilter || sentimentFilter === 'positive') && <div style={{ marginBottom: 16 }}><Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 600, display: 'block', marginBottom: 8 }}>✅ Позитивные</Text><Space direction="vertical" style={{ width: '100%' }} size={6}>{tagGroups.positive.map((tag) => <TagButton key={tag.id} tag={tag} selected={selectedTagIds.includes(tag.id)} disabled={!canAddMoreTags} onClick={() => handleTagClick(tag)} />)}</Space></div>}
                {(!sentimentFilter || sentimentFilter === 'negative') && <div><Text style={{ fontSize: 12, color: '#ff4d4f', fontWeight: 600, display: 'block', marginBottom: 8 }}>❌ Негативные</Text><Space direction="vertical" style={{ width: '100%' }} size={6}>{tagGroups.negative.map((tag) => <TagButton key={tag.id} tag={tag} selected={selectedTagIds.includes(tag.id)} disabled={!canAddMoreTags} onClick={() => handleTagClick(tag)} />)}</Space></div>}
                {selectedTagIds.length > 0 && <Button size="small" type="text" danger style={{ marginTop: 12 }} onClick={() => { setSelectedTagIds([]); setSentimentFilter(null); }}>Сбросить выбор</Button>}
              </div>
            )}

            {currentStep === 2 && (
              <Space direction="vertical" style={{ width: '100%' }} size={20}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>Комментарий *</Text>
                    <Text type={comment.trim().length >= MIN_COMMENT_LENGTH ? 'success' : 'secondary'} style={{ fontSize: 12 }}>{comment.trim().length} / мин. {MIN_COMMENT_LENGTH}</Text>
                  </div>
                  <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опишите конкретную ситуацию..." rows={5} maxLength={1000} showCount style={{ borderRadius: 8 }} />
                  {comment.trim().length > 0 && comment.trim().length < MIN_COMMENT_LENGTH && <Text type="danger" style={{ fontSize: 12 }}>Минимум {MIN_COMMENT_LENGTH} символов</Text>}
                </div>
                <Card size="small" style={{ borderRadius: 10, background: isAnonymous ? '#f0f2f5' : 'white', border: '1px solid #e8e8e8' }} bodyStyle={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space><EyeInvisibleOutlined style={{ color: '#8c8c8c' }} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>Анонимный отзыв</div><div style={{ fontSize: 12, color: '#8c8c8c' }}>Получатель не увидит ваше имя</div></div></Space>
                    <Switch checked={isAnonymous} onChange={setIsAnonymous} />
                  </div>
                </Card>
                {submitError && <Alert message={submitError} type="error" showIcon closable onClose={() => setSubmitError(null)} style={{ borderRadius: 8 }} />}
              </Space>
            )}

            <Divider style={{ margin: '24px 0 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep((s) => s - 1)} disabled={currentStep === 0}>Назад</Button>
              {currentStep < 2
                ? <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={() => setCurrentStep((s) => s + 1)} disabled={(currentStep === 0 && !isStep0Valid) || (currentStep === 1 && !isStep1Valid)}>Далее</Button>
                : <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={isLoading} disabled={!isStep2Valid}>Отправить отзыв</Button>
              }
            </div>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <div style={{ position: 'sticky', top: 88 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}><InfoCircleOutlined /> Предпросмотр</Text>
            <FeedbackPreview recipient={selectedColleague} task={selectedTask} selectedTags={selectedTags} comment={comment} isAnonymous={isAnonymous} />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default FeedbackFormPage;