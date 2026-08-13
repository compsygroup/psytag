import warnings
from typing import Any, Sequence, Dict, Union

Number = Union[int, float]

def exact_agreement(data: Sequence[Any]) -> bool:
    """
    Return True if all entries in data agree exactly.
    If len(data)<2: warn and return True.
    """
    n = len(data)
    if n < 2:
        warnings.warn("exact_agreement: fewer than 2 items to compare; returning True")
        return True

    first = data[0]
    t0 = type(first)

    for other in data[1:]:
        # type mismatch
        if type(other) is not t0:
            warnings.warn(f"exact_agreement: type mismatch {t0} vs {type(other)}")
            return False

        # builtin equality handles constants, lists, nested lists, etc.
        if first != other:
            return False

    return True


def delta_agreement(data: Sequence[Any], delta: Number) -> bool:
    """
    Return True if every item in `data` is within `delta` of each other.
    If len(data)<2: warn and return True.
    """
    n = len(data)
    if n < 2:
        warnings.warn("delta_agreement: fewer than 2 items to compare; returning True")
        return True

    for i in range(n-1):
        first = data[i]
        t0 = type(first)
        for j in range(i+1, n):
            other = data[j]
            # type mismatch
            if type(other) is not t0:
                warnings.warn(f"delta_agreement: type mismatch {t0} vs {type(other)}")
                return False
            if not _within_delta(first, other, delta):
                return False

    return True

def _within_delta(a: Any, b: Any, delta: Number) -> bool:
    # constant numeric
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= delta
    
    # string that can be converted to numeric
    if isinstance(a, (str, bytes)) or isinstance(b, (str, bytes)):
        # check if both can be converted to float
        try:
            a_num = float(a)
            b_num = float(b)
        except (ValueError, TypeError):
            return False
        return abs(a_num - b_num) <= delta

    # list or list of lists
    if isinstance(a, Sequence) and not isinstance(a, (str, bytes)):
        if len(a) != len(b):
            return False
        # recursive elementwise check 
        return all(_within_delta(x, y, delta) for x, y in zip(a, b))

    warnings.warn(f"delta_agreement: unsupported type {type(a)}")
    return False


def needs_adjudication(data: Sequence[Any], function: str, parameters: Dict[str, Any]) -> bool:
    # Call the appropriate function based on the provided name
    if function == "exact_agreement":
        result = exact_agreement(data)
    elif function == "delta_agreement":
        result = delta_agreement(data, **parameters)
    else:
        raise ValueError(f"Unknown adjudication function: {function}")

    return not result


def validate_adjudication(data: Sequence[Any], function: str, parameters: Dict[str, Any]) -> bool:
    # Validate if the adjudication function can be applied to the data
    if function == "exact_agreement":
        # invalid only if data items are of mixed types
        first_type = None
        for item in data:
            if first_type is None:
                first_type = type(item)
            elif type(item) is not first_type:
                return False
        return True
    elif function == "delta_agreement":
        # check if 'delta' parameter is provided and is numeric
        if 'delta' not in parameters:
            return False
        if not isinstance(parameters['delta'], (int, float)):
            return False
        
        # check if data items are of mixed types
        first_type = None
        for item in data:
            if first_type is None:
                first_type = type(item)
            elif type(item) is not first_type:
                return False

        # check if all data items are numeric or convertible to numeric
        for item in data:
            if isinstance(item, (int, float)):
                continue
            if isinstance(item, (str, bytes)):
                try:
                    float(item)
                except (ValueError, TypeError):
                    return False
            # if list or list of lists, we need to check elements recursively
            elif isinstance(item, Sequence) and not isinstance(item, (str, bytes)):
                def check_numeric(seq):
                    for elem in seq:
                        if isinstance(elem, (int, float)):
                            continue
                        elif isinstance(elem, (str, bytes)):
                            try:
                                float(elem)
                            except (ValueError, TypeError):
                                return False
                        elif isinstance(elem, Sequence) and not isinstance(elem, (str, bytes)):
                            if not check_numeric(elem):
                                return False
                        else:
                            return False
                    return True
                return check_numeric(item)
            else:
                return False
       
        return True
    else:
        return False  # unknown function