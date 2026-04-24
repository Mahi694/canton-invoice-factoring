import React from 'react';
import { Card, CardContent, Typography, Grid, Chip, Box, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BusinessIcon from '@mui/icons-material/Business';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PercentIcon from '@mui/icons-material/Percent';
import PaidIcon from '@mui/icons-material/Paid';

/**
 * A unified data structure representing an invoice, typically assembled by a
 * service layer from various Daml contracts (e.g., IssuedInvoice, FactoringOffer, FactoringAgreement).
 */
export interface InvoiceDetails {
  // Common fields from Daml contract payload
  invoiceId: string;
  supplier: string; // Party string
  buyer: string; // Party string
  factor: string | null;
  amount: number;
  dueDate: Date;

  // Status derived from the template of the underlying contract
  status: 'Issued' | 'Offered' | 'Factored' | 'Repaid' | 'Overdue';

  // Fields from factoring-related contracts
  advanceRate?: number; // e.g., 0.95 for 95%
  advanceAmount?: number;
  discountFee?: number;

  // The contract ID, needed for exercising choices
  contractId: string;
}

interface InvoiceCardProps {
  invoice: InvoiceDetails;
  party: string; // The party viewing the card, to determine which actions are available
  onAcceptOffer?: (contractId: string) => void;
  onPlaceBid?: (invoiceId: string) => void;
}

const StatusChip = styled(Chip)<{ status: InvoiceDetails['status'] }>(({ theme, status }) => {
  let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
  switch (status) {
    case 'Issued':
      color = 'info';
      break;
    case 'Offered':
      color = 'secondary';
      break;
    case 'Factored':
      color = 'primary';
      break;
    case 'Repaid':
      color = 'success';
      break;
    case 'Overdue':
      color = 'error';
      break;
  }
  return {
    backgroundColor: theme.palette[color].light,
    color: theme.palette[color].dark,
    fontWeight: 'bold',
  };
});

const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[6],
  },
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius * 2,
}));

const CardHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const CardFooter = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  marginTop: 'auto',
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const InfoItem: React.FC<{ icon: React.ReactElement; label: string; value: string | React.ReactNode }> = ({ icon, label, value }) => (
  <Box display="flex" alignItems="center" my={0.5}>
    {React.cloneElement(icon, { sx: { mr: 1.5, color: 'text.secondary', fontSize: '1.25rem' } })}
    <Box>
      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{label}</Typography>
      <Typography variant="body2" fontWeight="500">{value}</Typography>
    </Box>
  </Box>
);

/**
 * InvoiceCard is a presentational component for displaying the state of a single invoice
 * in the factoring workflow. It adapts its appearance and available actions based on the
 * invoice status and the role of the party viewing it.
 */
const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, party, onAcceptOffer, onPlaceBid }) => {

  const { invoiceId, supplier, buyer, factor, amount, dueDate, status, advanceRate, advanceAmount, contractId } = invoice;

  const isSupplier = party === supplier;
  // A simplification: any party that isn't the supplier or buyer is a potential factor.
  const isFactor = !isSupplier && party !== buyer;

  const renderActionButtons = () => {
    switch (status) {
      case 'Issued':
        // A factor can place a bid on an issued invoice.
        return isFactor && onPlaceBid && (
          <Button fullWidth variant="contained" color="secondary" onClick={() => onPlaceBid(invoiceId)}>
            Place Bid
          </Button>
        );
      case 'Offered':
        // The supplier can accept a factor's offer.
        return isSupplier && onAcceptOffer && (
          <Button fullWidth variant="contained" color="primary" onClick={() => onAcceptOffer(contractId)}>
            Accept Offer
          </Button>
        );
      default:
        // No actions for Factored, Repaid, or Overdue states on this component.
        return null;
    }
  };

  return (
    <StyledCard variant="outlined">
      <CardHeader>
        <Box display="flex" alignItems="center">
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="div">
            Invoice <Typography component="span" color="text.secondary" sx={{ fontFamily: "monospace" }}>#{invoiceId.substring(0, 8)}</Typography>
          </Typography>
        </Box>
        <StatusChip status={status} label={status} size="small"/>
      </CardHeader>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <InfoItem
              icon={<MonetizationOnIcon />}
              label="Invoice Amount"
              value={amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <InfoItem
              icon={<CalendarTodayIcon />}
              label="Due Date"
              value={dueDate.toLocaleDateString()}
            />
          </Grid>
          <Grid item xs={12}>
            <InfoItem icon={<BusinessIcon />} label="Supplier" value={supplier.split('::')[0]} />
          </Grid>
          <Grid item xs={12}>
            <InfoItem icon={<BusinessIcon />} label="Buyer" value={buyer.split('::')[0]} />
          </Grid>
          {factor && (
            <Grid item xs={12}>
              <InfoItem icon={<BusinessIcon />} label="Factor" value={factor.split('::')[0]} />
            </Grid>
          )}
          {(status === 'Offered' || status === 'Factored' || status === 'Repaid') && typeof advanceRate === 'number' && (
             <Grid item xs={12} sm={6}>
              <InfoItem
                icon={<PercentIcon />}
                label="Advance Rate"
                value={`${(advanceRate * 100).toFixed(1)}%`}
              />
            </Grid>
          )}
           {(status === 'Factored' || status === 'Repaid') && typeof advanceAmount === 'number' && (
             <Grid item xs={12} sm={6}>
              <InfoItem
                icon={<PaidIcon />}
                label="Advance Paid"
                value={advanceAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              />
            </Grid>
          )}
        </Grid>
      </CardContent>
      {renderActionButtons() && (
        <CardFooter>
          {renderActionButtons()}
        </CardFooter>
      )}
    </StyledCard>
  );
};

export default InvoiceCard;