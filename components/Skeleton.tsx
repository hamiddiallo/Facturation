import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
    width?: string;
    height?: string;
    borderRadius?: string;
    className?: string;
}

export default function Skeleton({ width, height, borderRadius, className }: SkeletonProps) {
    const style: React.CSSProperties = {
        width: width || '100%',
        height: height || '20px',
        borderRadius: borderRadius || '4px',
    };

    return <div className={`${styles.skeleton} ${className || ''}`} style={style} />;
}
