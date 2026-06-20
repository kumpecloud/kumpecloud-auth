import logoUrl from '@/shared/assets/logo.png';

import styles from './index.module.scss';

type Props = {
  readonly className?: string;
};

const LogtoSignature = ({ className }: Props) => {
  return (
    <div className={className}>
      <img alt="KumpeCloud Auth" className={styles.logo} draggable={false} src={logoUrl} />
    </div>
  );
};

export default LogtoSignature;
