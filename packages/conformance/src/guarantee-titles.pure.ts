const guaranteeTitles = {
  closedRefusesMoney: "a closed account refuses deposits, withdrawals and a second closing with NotOpen",
  closesOnlyWhenEmpty: "an account closes only at a balance of zero, and then reads as closed",
  depositReplies: "a deposit replies with the new balance, and a read at its receipt shows that balance",
  neverOpened: "an account that was never opened refuses money with NotOpen and reads as nothing",
  opensAtZero: "an opened account reads as open, with its owner and a balance of zero",
  opensOnce: "an account opens once: opening it again is refused with AlreadyOpen and keeps the first owner",
  overdraftRefused:
    "a withdrawal larger than the balance is refused with InsufficientFunds, carrying the balance and the amount, and moves no money",
  retriedCommandId: "a command retried with the same command id returns the first receipt and moves the money once",
} as const;

type GuaranteeName = keyof typeof guaranteeTitles;

export { guaranteeTitles };

export type { GuaranteeName };
