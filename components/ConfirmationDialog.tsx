import React from 'react';
import Modal from './Modal';
import styles from './ConfirmationDialog.module.css';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'info';
}

export default function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    type = 'info'
}: ConfirmationDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="400px">
            <div className={styles.container}>
                <div className={`${styles.iconWrapper} ${styles[type]}`}>
                    {type === 'danger' ? <AlertTriangle size={24} /> : <Info size={24} />}
                </div>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button className={styles.cancelButton} onClick={onClose}>
                        {cancelLabel}
                    </button>
                    <button
                        className={`${styles.confirmButton} ${styles[type]}`}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
