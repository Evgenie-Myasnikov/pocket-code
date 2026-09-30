package app.pocketcode.mobile;

final class UpdateNumbers {
    private UpdateNumbers() {}
    static Long positiveInteger(Object value) {
        if (!(value instanceof Number)) return null;
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 1 || number > 9007199254740991d || number != Math.rint(number)) return null;
        return ((Number) value).longValue();
    }
}
