# Career-switch ROI: python3 ideas/career-switch-roi.py — edit the salaries in the loop below to try your own.
# Monthly simulation over 10 years, gross ILS, real terms. Stay path grows 2%/yr.
def ramp(m, start, end, months=60):
    return start + (end - start) * min(m, months) / months

def paths(S):
    stay = lambda m: S * 1.02 ** (m / 12)
    def cs(m):   # full-time degree, 40% job, 6mo search, 20k->32k
        if m < 36: return 0.4 * S
        if m < 42: return 0
        return ramp(m - 42, 20000, 32000)
    def boot(m): # 9mo full-time, 6mo search, 15k->26k
        if m < 9: return 0
        if m < 15: return 0
        return ramp(m - 15, 15000, 26000)
    def econ(m): # evening degree, keep 90%, then max(stay, 13k->20k)
        if m < 36: return 0.9 * stay(m)
        return max(stay(m), ramp(m - 36, 13000, 20000))
    def cpa(m):  # degree at 60%, 24mo internship 9.5k, then 16k->28k
        if m < 36: return 0.6 * S
        if m < 60: return 9500
        return ramp(m - 60, 16000, 28000)
    def mkt_job(m):  # 6mo evening course while working, job hunt while employed, then junior 9.5k->17k
        if m < 9: return stay(m)
        return ramp(m - 9, 9500, 17000)
    def mkt_side(m):  # keep the job; freelance clients from month 6 ramp 0->5k/mo over 3y; tools 300/mo
        side = 0 if m < 6 else ramp(m - 6, 0, 5000, 36)
        return stay(m) + side - 300
    return stay, {"CS degree": (cs, 35000), "Bootcamp": (boot, 40000),
                  "Econ/MBA evening": (econ, 45000), "CPA": (cpa, 50000),
                  "Marketing job": (mkt_job, 8000), "Marketing side biz": (mkt_side, 8000)}

for S in (9000, 13000, 17000):
    stay, ps = paths(S)
    print(f"\n== current salary {S} ==")
    for name, (f, tuition) in ps.items():
        cum, worst, be = -tuition, -tuition, None
        for m in range(120):
            cum += f(m) - stay(m)
            worst = min(worst, cum)
            if be is None and m > 0 and cum >= 0: be = m + 1
        print(f"{name:18} max_investment={-worst/1000:6.0f}k  breakeven={'-' if be is None else f'{be/12:.1f}y':>6}  net10y={cum/1000:6.0f}k")
