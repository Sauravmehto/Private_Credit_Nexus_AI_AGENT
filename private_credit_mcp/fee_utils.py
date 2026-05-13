"""Fee normalization: ratios < 1 are treated as fractions of principal."""


def normalize_orig_eot_fees(principal: float, orig_fee: float, eot_fee: float) -> tuple[float, float]:
    o = orig_fee * principal if orig_fee < 1 else orig_fee
    e = eot_fee * principal if eot_fee < 1 else eot_fee
    return o, e
