import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Result, Button, Typography } from 'antd';
import { ReloadOutlined, BugOutlined } from '@ant-design/icons';
import { reportError, wrapError } from '../../utils/errorHandler';
import { I18nContext } from '../../i18n/I18nProvider';

const { Paragraph, Text } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/** 全局错误边界 — 捕获 React 渲染错误，避免白屏 */
class ErrorBoundary extends Component<Props, State> {
  static contextType = I18nContext;
  declare context: React.ContextType<typeof I18nContext>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(wrapError(error, 'ErrorBoundary'));
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleHardReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { t } = this.context;
    const isDev = import.meta.env.DEV;
    const error = this.state.error;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24 }}>
        <Result
          status="error"
          icon={<BugOutlined style={{ color: '#ef4444' }} />}
          title={t('errorBoundary.title')}
          subTitle={t('errorBoundary.subTitle')}
          extra={[
            <Button key="reload" type="primary" icon={<ReloadOutlined />} onClick={this.handleReload}>
              {t('errorBoundary.retry')}
            </Button>,
            <Button key="hard" onClick={this.handleHardReload}>
              {t('errorBoundary.hardReload')}
            </Button>,
          ]}
        >
          {isDev && error && (
            <div style={{ textAlign: 'left', maxWidth: 680, margin: '0 auto' }}>
              <Paragraph>
                <Text strong>{t('errorBoundary.errorMessage')}: </Text>
                <Text type="danger">{error.message}</Text>
              </Paragraph>
              {this.state.errorInfo?.componentStack && (
                <Paragraph>
                  <Text strong>{t('errorBoundary.componentStack')}:</Text>
                  <pre
                    style={{
                      fontSize: 12,
                      background: 'rgba(0,0,0,0.04)',
                      padding: 12,
                      borderRadius: 8,
                      overflow: 'auto',
                      maxHeight: 300,
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                </Paragraph>
              )}
              {error.stack && (
                <Paragraph>
                  <Text strong>{t('errorBoundary.callStack')}:</Text>
                  <pre
                    style={{
                      fontSize: 12,
                      background: 'rgba(0,0,0,0.04)',
                      padding: 12,
                      borderRadius: 8,
                      overflow: 'auto',
                      maxHeight: 300,
                    }}
                  >
                    {error.stack}
                  </pre>
                </Paragraph>
              )}
            </div>
          )}
        </Result>
      </div>
    );
  }
}

export default ErrorBoundary;
