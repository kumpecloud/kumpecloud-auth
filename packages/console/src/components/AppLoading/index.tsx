import BrandLogo from '@/components/BrandLogo';
import { Daisy as Spinner } from '@/ds-components/Spinner';

import styles from './index.module.scss';

function AppLoading() {
  return (
    <div className={styles.container}>
      <BrandLogo />
      <Spinner />
    </div>
  );
}

export default AppLoading;
