import { motion, useInView, type Variants } from 'motion/react';
import React, { useMemo, useRef } from 'react';

interface TimelineContentProps {
  children: React.ReactNode;
  animationNum: number;
  timelineRef: React.RefObject<HTMLElement | null>;
  customVariants?: Variants;
  className?: string;
  as?: React.ElementType;
  once?: boolean;
  [key: string]: unknown;
}

const defaultVariants: Variants = {
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: i * 0.2, duration: 0.6 },
  }),
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
};

/**
 * Scroll-reveal wrapper used by the about section. Animates each child into view
 * with a per-index delay, driven by a shared `timelineRef`.
 */
export const TimelineContent = ({
  children,
  animationNum,
  timelineRef,
  customVariants,
  className,
  as = 'div',
  once = true,
  ...props
}: TimelineContentProps) => {
  const isInView = useInView(timelineRef, { once, amount: 0.2 });
  const MotionComponent = useMemo(
    () => motion.create(as as React.ElementType),
    [as]
  );

  return (
    <MotionComponent
      ref={useRef(null)}
      custom={animationNum}
      variants={customVariants ?? defaultVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};
