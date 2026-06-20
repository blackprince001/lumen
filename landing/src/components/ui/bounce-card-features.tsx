import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export const BounceCard = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <motion.div
      whileHover={{ scale: 0.97, rotate: '-1deg' }}
      className={cn(
        'group relative min-h-[460px] cursor-pointer overflow-hidden rounded-3xl bg-card-surface p-8 md:min-h-[500px]',
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export const CardTitle = ({ children }: { children: ReactNode }) => {
  return (
    <h3 className="text-2xl font-semibold tracking-tight text-forest">
      {children}
    </h3>
  );
};
