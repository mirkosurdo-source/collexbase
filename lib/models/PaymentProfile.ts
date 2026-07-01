import { Schema, models, model } from "mongoose"

/**
 * Links a CollexBase user to their Stripe Customer and caches saved card
 * metadata (never raw card data — only Stripe payment-method ids + display
 * info returned by Stripe).
 */
const SavedMethodSchema = new Schema(
  {
    paymentMethodId: { type: String, required: true },
    brand: { type: String, default: "" },
    last4: { type: String, default: "" },
    expMonth: { type: Number, default: 0 },
    expYear: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
)

const PaymentProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    stripeCustomerId: { type: String, default: "", index: true },
    defaultPaymentMethodId: { type: String, default: "" },
    methods: { type: [SavedMethodSchema], default: [] },
    // IBAN used for payouts (withdrawals). Stored masked for display.
    payoutIbanLast4: { type: String, default: "" },
  },
  { timestamps: true },
)

const PaymentProfile = models.PaymentProfile || model("PaymentProfile", PaymentProfileSchema)

export default PaymentProfile
