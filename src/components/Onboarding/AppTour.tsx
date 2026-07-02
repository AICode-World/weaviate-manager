import { useEffect, useState } from 'react';
import { Tour } from 'antd';
import type { TourProps } from 'antd';
import { useI18n } from '../../i18n/I18nProvider';

const TOUR_DONE_KEY = 'weaviate_onboarding_done';

interface AppTourProps {
  refs: {
    connection: React.RefObject<HTMLDivElement | null>;
    collections: React.RefObject<HTMLDivElement | null>;
    dashboardBtn: React.RefObject<HTMLButtonElement | null>;
    dataBtn: React.RefObject<HTMLButtonElement | null>;
  };
}

export const TOUR_REPLAY_EVENT = 'weaviate-tour-replay';

const AppTour: React.FC<AppTourProps> = ({ refs }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_DONE_KEY);
    if (!done) {
      // 延迟显示，确保 DOM 已渲染
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // 监听 replay 事件（由右上角 Replay Tour 按钮触发）
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(TOUR_DONE_KEY);
      setOpen(true);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, handler);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handler);
  }, []);

  const handleClose = () => {
    localStorage.setItem(TOUR_DONE_KEY, '1');
    setOpen(false);
  };

  const steps: TourProps['steps'] = [
    {
      title: t('onboardingWelcome'),
      description: t('onboardingWelcomeDesc'),
      cover: (
        <div style={{ textAlign: 'center', fontSize: 48, padding: '16px 0' }}>🚀</div>
      ),
    },
    {
      title: t('tourConnection'),
      description: t('tourConnectionDesc'),
      target: () => refs.connection.current!,
    },
    {
      title: t('tourDashboard'),
      description: t('tourDashboardDesc'),
      target: () => refs.dashboardBtn.current!,
    },
    {
      title: t('tourDataBrowse'),
      description: t('tourDataBrowseDesc'),
      target: () => refs.dataBtn.current!,
    },
  ];

  if (!open) return null;

  return (
    <Tour
      open={open}
      onClose={handleClose}
      steps={steps}
      type="primary"
      indicatorsRender={(current, total) => (
        <span style={{ fontSize: 12 }}>{current + 1} / {total}</span>
      )}
    />
  );
};

export default AppTour;

export const markTourDone = () => localStorage.setItem(TOUR_DONE_KEY, '1');
export const resetTour = () => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
