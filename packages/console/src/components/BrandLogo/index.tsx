import classNames from 'classnames';
import type { KeyboardEvent } from 'react';

import logoUrl from '@/assets/images/logo.png';

type Props = {
  readonly className?: string;
  readonly onClick?: () => void;
};

function BrandLogo({ className, onClick }: Props) {
  return (
    <img
      alt="KumpeCloud Auth"
      className={classNames(className)}
      draggable={false}
      src={logoUrl}
      {...(onClick && {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
      })}
    />
  );
}

export default BrandLogo;
