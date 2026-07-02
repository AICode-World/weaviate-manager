import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

/**
 * 通用空状态组件
 * 提供统一的空状态展示，包含图标、标题、描述和操作按钮
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon = <InboxOutlined />, title, description, actionText, onAction }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-text-quaternary)' }}>
          {icon}
        </div>
      )}
      <Text strong style={{ fontSize: 16, color: 'var(--color-text-primary)', marginBottom: description ? 8 : 0 }}>
        {title}
      </Text>
      {description && (
        <Text style={{ color: 'var(--color-text-tertiary)', fontSize: 14, maxWidth: 400 }}>
          {description}
        </Text>
      )}
      {actionText && onAction && (
        <Button type="primary" onClick={onAction} style={{ marginTop: 20 }}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
