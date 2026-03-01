import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Typography, Button, Tag, Avatar, Space, Spin, Empty,
  Progress, Statistic, List, Badge, Alert,
} from 'antd';
import {
  PlusCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, SmileOutlined,
  FrownOutlined, FireOutlined, ClockCircleOutlined, SendOutlined,
  InboxOutlined, BarChartOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { feedbackApi } from '../api/feedback';
import { analyticsApi } from '../api/analytics';
import { FeedbackListItem, FeedbackLimits, AnalyticsSummary, LeaderboardEntry } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Title, Text, Paragraph } = Typography;

const SentimentTag: React.FC<{ sentiment: string | null }> = ({ sentiment }) => {
  if (sentiment === 'positive') return <Tag color="success" icon={<SmileOutlined />}>Позитивный</Tag>;
  if (sentiment === 'negative') return <Tag color="error" icon={<FrownOutlined />}>Негативный</Tag>;
  return <Tag>Нейтральный</Tag>;
};

const FeedbackCard: React.FC<{ item: FeedbackListItem; type: 'given' | 'received' }> = ({ item, type }) => {
  const isPositive = item.sentiment === 'positive';
  const borderColor = isPositive ? '#52c41a' : '#ff4d4f';
  const bgColor = isPositive ? '#f6ffed' : '#fff2f0';
  const person = type === 'given' ? item.recipient : item.author;

  return (
    <Card size="small" style={{ borderRadius: 12, borderLeft: `4px solid ${borderColor}`, background: bgColor, marginBottom: 8 }} bodyStyle={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space align="start" size={10}>
          <Avatar style={{ backgroundColor: person && 'avatar_color' in person ? (person as any).avatar_color : '#808080', flexShrink: 0 }} size={36}>
            {person?.initials || '??'}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{type === 'given' ? '→ ' : '← '}{person?.full_name || 'Анонимный коллега'}</div>
            {/* ИЗМЕНЕНИЕ: Только название задачи, без кода */}
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{item.task?.title}</div>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {item.tags.map((tag) => (
                <span key={tag.id} style={{ background: tag.color + '20', border: `1px solid ${tag.color}40`, color: tag.color, borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 500 }}>
                  {tag.icon} {tag.name}
                </span>
              ))}
            </div>
            {item.comment && <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 12, color: '#595959', marginTop: 6, marginBottom: 0 }}>{item.comment}</Paragraph>}
          </div>
        </Space>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <SentimentTag sentiment={item.sentiment} />
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{dayjs(item.created_at).fromNow()}</div>
        </div>
      </div>
    </Card>
  );
};

const LimitsCard: React.FC<{ limits: FeedbackLimits }> = ({ limits }) => {
  const navigate = useNavigate();
  const todayPct = Math.round((limits.today.used / limits.today.limit) * 100);
  const weekPct = Math.round((limits.week.used / limits.week.limit) * 100);
  const getColor = (pct: number) => { if (pct >= 100) return '#ff4d4f'; if (pct >= 80) return '#fa8c16'; return '#52c41a'; };

  return (
    <Card title={<Space><ClockCircleOutlined style={{ color: '#1890ff' }} /><span>Лимиты отзывов</span></Space>} style={{ borderRadius: 12 }} bodyStyle={{ padding: '16px 24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 13 }}>Сегодня</Text>
            <Text strong style={{ color: getColor(todayPct) }}>{limits.today.used} / {limits.today.limit}</Text>
          </div>
          <Progress percent={todayPct} showInfo={false} strokeColor={getColor(todayPct)} trailColor="#f0f0f0" size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>Осталось: {limits.today.remaining}</Text>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 13 }}>На этой неделе</Text>
            <Text strong style={{ color: getColor(weekPct) }}>{limits.week.used} / {limits.week.limit}</Text>
          </div>
          <Progress percent={weekPct} showInfo={false} strokeColor={getColor(weekPct)} trailColor="#f0f0f0" size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>Осталось: {limits.week.remaining}</Text>
        </div>
        {limits.today.remaining === 0 && <Alert message="Дневной лимит исчерпан" description="Вы сможете оставить отзыв завтра" type="warning" showIcon style={{ borderRadius: 8 }} />}
        <Button type="primary" icon={<PlusCircleOutlined />} block disabled={limits.today.remaining === 0} onClick={() => navigate('/feedback/new')}>Оставить отзыв</Button>
      </Space>
    </Card>
  );
};

const LeaderboardCard: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Card title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><span>Топ сотрудников</span></Space>} style={{ borderRadius: 12 }} bodyStyle={{ padding: '8px 0' }}>
      {entries.length === 0 ? <Empty description="Нет данных" style={{ padding: 24 }} /> : (
        <List dataSource={entries.slice(0, 5)} renderItem={(entry) => (
          <List.Item style={{ padding: '10px 24px' }} extra={
            <Space direction="vertical" align="end" size={0}>
              <Space size={4}>
                <Tag color="success" style={{ margin: 0 }}>+{entry.positive_received}</Tag>
                {entry.negative_received > 0 && <Tag color="error" style={{ margin: 0 }}>-{entry.negative_received}</Tag>}
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>{entry.positive_rate}% позитив</Text>
            </Space>
          }>
            <List.Item.Meta
              avatar={<div style={{ position: 'relative' }}><Avatar style={{ backgroundColor: entry.user.avatar_color }} size={38}>{entry.user.initials}</Avatar>{entry.rank <= 3 && <span style={{ position: 'absolute', top: -6, right: -6, fontSize: 14 }}>{medals[entry.rank - 1]}</span>}</div>}
              title={<Text strong style={{ fontSize: 13 }}>{entry.user.short_name}</Text>}
              description={<Text type="secondary" style={{ fontSize: 12 }}>{entry.user.position || entry.user.department || 'Сотрудник'}</Text>}
            />
          </List.Item>
        )} />
      )}
    </Card>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [givenFeedback, setGivenFeedback] = useState<FeedbackListItem[]>([]);
  const [receivedFeedback, setReceivedFeedback] = useState<FeedbackListItem[]>([]);
  const [limits, setLimits] = useState<FeedbackLimits | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'given' | 'received'>('received');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [givenRes, receivedRes, limitsRes] = await Promise.all([
        feedbackApi.my({ page: 1 }), feedbackApi.received({ page: 1 }), feedbackApi.limits(),
      ]);
      setGivenFeedback(givenRes.results);
      setReceivedFeedback(receivedRes.results);
      setLimits(limitsRes);
      if (user?.is_manager) {
        const [summaryRes, leaderboardRes] = await Promise.all([
          analyticsApi.summary({ period: 'month' }), analyticsApi.leaderboard({ period: 'month', limit: 5 }),
        ]);
        setSummary(summaryRes);
        setLeaderboard(leaderboardRes);
      }
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setIsLoading(false); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;

  const currentFeedback = activeTab === 'given' ? givenFeedback : receivedFeedback;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Привет, {user?.first_name}! 👋</Title>
        <Text type="secondary">{dayjs().format('dddd, D MMMM YYYY')}</Text>
      </div>

      {user?.is_manager && summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}><Card style={{ borderRadius: 12, textAlign: 'center' }} bodyStyle={{ padding: 20 }}><Statistic title="Всего отзывов" value={summary.total_feedback} valueStyle={{ color: '#1890ff', fontSize: 28 }} /></Card></Col>
          <Col xs={12} sm={6}><Card style={{ borderRadius: 12, textAlign: 'center' }} bodyStyle={{ padding: 20 }}><Statistic title="Позитивных" value={summary.positive_feedback} valueStyle={{ color: '#52c41a', fontSize: 28 }} prefix={<ArrowUpOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card style={{ borderRadius: 12, textAlign: 'center' }} bodyStyle={{ padding: 20 }}><Statistic title="Негативных" value={summary.negative_feedback} valueStyle={{ color: '#ff4d4f', fontSize: 28 }} prefix={<ArrowDownOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card style={{ borderRadius: 12, textAlign: 'center' }} bodyStyle={{ padding: 20 }}><Statistic title="Позитивность" value={summary.positive_rate} suffix="%" valueStyle={{ color: summary.positive_rate >= 70 ? '#52c41a' : '#fa8c16', fontSize: 28 }} /></Card></Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={user?.is_manager ? 14 : 16}>
          <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}
            title={
              <div style={{ display: 'flex', gap: 0, background: '#f5f5f5', borderRadius: 8, padding: 3, width: 'fit-content' }}>
                <button onClick={() => setActiveTab('received')} style={{
                  border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: activeTab === 'received' ? 'white' : 'transparent',
                  color: activeTab === 'received' ? '#1890ff' : '#8c8c8c',
                  boxShadow: activeTab === 'received' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <InboxOutlined />Полученные
                  <Badge count={receivedFeedback.length} size="small" style={{ backgroundColor: activeTab === 'received' ? '#1890ff' : '#d9d9d9' }} />
                </button>
                <button onClick={() => setActiveTab('given')} style={{
                  border: 'none', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  background: activeTab === 'given' ? 'white' : 'transparent',
                  color: activeTab === 'given' ? '#1890ff' : '#8c8c8c',
                  boxShadow: activeTab === 'given' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <SendOutlined />Отданные
                  <Badge count={givenFeedback.length} size="small" style={{ backgroundColor: activeTab === 'given' ? '#1890ff' : '#d9d9d9' }} />
                </button>
              </div>
            }
            extra={<Button type="primary" size="small" icon={<PlusCircleOutlined />} onClick={() => navigate('/feedback/new')}>Новый отзыв</Button>}
          >
            <div style={{ padding: '16px', maxHeight: 520, overflowY: 'auto' }}>
              {currentFeedback.length === 0 ? (
                <Empty description={activeTab === 'received' ? 'Вы ещё не получали отзывов' : 'Вы ещё не оставляли отзывов'} style={{ padding: 32 }}>
                  {activeTab === 'given' && <Button type="primary" onClick={() => navigate('/feedback/new')}>Оставить первый отзыв</Button>}
                </Empty>
              ) : currentFeedback.map((item) => <FeedbackCard key={item.id} item={item} type={activeTab} />)}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={user?.is_manager ? 10 : 8}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {limits && <LimitsCard limits={limits} />}
            {user?.is_manager && leaderboard.length > 0 && <LeaderboardCard entries={leaderboard} />}
            {!user?.is_manager && (
              <Card title="Быстрые действия" style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                <Button block type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/feedback/new')} disabled={limits?.today.remaining === 0}>Оставить отзыв</Button>
              </Card>
            )}
            {user?.is_manager && (
              <Card title="Управление" style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <Button block icon={<BarChartOutlined />} onClick={() => navigate('/analytics')}>Аналитика</Button>
                  <Button block icon={<FileTextOutlined />} onClick={() => navigate('/reports')}>Отчёты</Button>
                </Space>
              </Card>
            )}
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;