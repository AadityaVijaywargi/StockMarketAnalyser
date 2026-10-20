import React, { useEffect, useState } from 'react';
import { PaperOrderTicket } from './PaperOrderTicket';
import { PaperAccount, paperTradingService } from '../../services/paper_trading_service';

type TicketProps = Omit<React.ComponentProps<typeof PaperOrderTicket>, 'account' | 'onClose'>;

/** The order ticket in a modal, loading the account itself (for use outside the Paper Trading page). */
export const PaperTradeModal: React.FC<TicketProps & { onClose: () => void }> = ({ onClose, ...ticket }) => {
  const [account, setAccount] = useState<PaperAccount | null>(null);

  useEffect(() => {
    paperTradingService.getAccount().then(setAccount).catch(() => setAccount(null));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-w-md w-full" onClick={e => e.stopPropagation()}>
        <PaperOrderTicket {...ticket} account={account} onClose={onClose} />
      </div>
    </div>
  );
};
