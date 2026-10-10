"""Business case model (issue #31, docs/business/business-case.md). Run: python3 docs/business/model.py"""

SQ_ACCOUNTS = 1_220_818 - 423_409  # Swissquote accounts excluding Yuh, 30 June 2026
ARPU_NEW = 300  # CHF / new client / year (about half of CHF 730 m / 1.22 m accounts)
COMMON = dict(price=6, fee=0.0085, op_cost=0.03, key=30, insurance=12, platform=1_000_000)

SCENARIOS = {
    "Cautious": dict(crypto_share=0.10, adoption=0.05, premium=0.03, l0_users=10_000, l0_conv=0.03, balance=1500, turnover=0.5, ops=6),
    "Median": dict(crypto_share=0.15, adoption=0.10, premium=0.06, l0_users=30_000, l0_conv=0.05, balance=2500, turnover=1.0, ops=8),
    "Ambitious": dict(crypto_share=0.20, adoption=0.20, premium=0.10, l0_users=80_000, l0_conv=0.08, balance=4000, turnover=1.5, ops=10),
}


def year_one(a, arpu_new=ARPU_NEW):
    a = {**COMMON, **a}
    linked = SQ_ACCOUNTS * a["crypto_share"] * a["adoption"]
    premium = linked * a["premium"]
    revenue = {
        "premium": premium * a["price"] * 12,
        "trading": linked * a["balance"] * a["turnover"] * a["fee"],
        "new_clients": a["l0_users"] * a["l0_conv"] * arpu_new,
    }
    cost = {
        "gas": (linked + a["l0_users"]) * a["ops"] * 12 * a["op_cost"],
        "keys_insurance": premium * (a["key"] / 3 + a["insurance"]),
        "platform": a["platform"],
    }
    return linked, premium, revenue, cost


if __name__ == "__main__":
    for name, a in SCENARIOS.items():
        linked, premium, revenue, cost = year_one(a)
        net = sum(revenue.values()) - sum(cost.values())
        print(f"{name:9s} linked {linked:,.0f}  premium {premium:,.0f}  revenue {sum(revenue.values()):,.0f}  cost {sum(cost.values()):,.0f}  net {net:,.0f}")

    median = SCENARIOS["Median"]
    adoption = 0.0
    while True:
        linked, _, revenue, cost = year_one({**median, "adoption": adoption})
        if sum(revenue.values()) >= sum(cost.values()) or adoption >= 1:
            break
        adoption += 0.005
    print(f"Break-even (median): {adoption:.1%} of crypto-active accounts linked, about {linked:,.0f} wallets")

    acquired, total = 0, 0
    for year, adoption in enumerate([0.10, 0.15, 0.20], 1):
        _, _, revenue, cost = year_one({**median, "adoption": adoption}, arpu_new=0)
        acquired += median["l0_users"] * median["l0_conv"]
        net = sum(revenue.values()) - sum(cost.values()) + acquired * ARPU_NEW
        total += net
        print(f"Year {year}: adoption {adoption:.0%}, acquired clients {acquired:,.0f}, net {net:,.0f}")
    print(f"3-year cumulative (median ramp): {total:,.0f}")
