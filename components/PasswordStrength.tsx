'use client';

import React, { useEffect, useMemo } from 'react';
import styles from './PasswordStrength.module.css';

interface Rule {
    id: string;
    label: string;
    test: (pw: string) => boolean;
}

interface PasswordStrengthProps {
    password: unknown;
    onValidate?: (isValid: boolean) => void;
}

export default function PasswordStrength({ password, onValidate }: PasswordStrengthProps) {
    const pw = typeof password === 'string' ? password : '';

    const rules: Rule[] = useMemo(() => [
        { id: 'length', label: '8 caractères minimum', test: (p) => p.length >= 8 },
        { id: 'upper', label: 'Une majuscule', test: (p) => /[A-Z]/.test(p) },
        { id: 'lower', label: 'Une minuscule', test: (p) => /[a-z]/.test(p) },
        { id: 'digit', label: 'Un chiffre', test: (p) => /[0-9]/.test(p) },
        { id: 'special', label: 'Un caractère spécial', test: (p) => /[^A-Za-z0-9]/.test(p) },
    ], []);

    const results = useMemo(() => {
        return rules.map(rule => ({
            ...rule,
            isValid: rule.test(pw)
        }));
    }, [pw, rules]);

    const allValid = results.every(r => r.isValid);

    useEffect(() => {
        onValidate?.(allValid);
    }, [allValid, onValidate]);

    if (!pw) return null;

    return (
        <div className={styles.container}>
            <div className={styles.title}>Sécurité du mot de passe</div>
            <ul className={styles.list}>
                {results.map(rule => (
                    <li key={rule.id} className={`${styles.item} ${rule.isValid ? styles.valid : styles.invalid}`}>
                        <span className={`${styles.icon} ${rule.isValid ? styles.iconValid : styles.iconInvalid}`}>
                            {rule.isValid ? '✓' : '○'}
                        </span>
                        {rule.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
