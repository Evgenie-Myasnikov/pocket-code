package app.pocketcode.mobile;
public final class UpdateNumbersTest {
    private static void value(Object input, Long expected) {
        Long actual = UpdateNumbers.positiveInteger(input);
        if (!java.util.Objects.equals(actual, expected)) throw new AssertionError("Unexpected numeric conversion for " + input);
    }
    public static void main(String[] args) {
        value(Integer.valueOf(15), 15L);
        value(Integer.valueOf(5270238), 5270238L);
        value(Long.valueOf(4000000000L), 4000000000L);
        value(Double.valueOf(15d), 15L);
        value(Long.valueOf(9007199254740991L), 9007199254740991L);
        for (Object invalid : new Object[]{null, "15", true, 0, -1, 1.5d, Double.NaN, Double.POSITIVE_INFINITY, 9007199254740992L, Long.MAX_VALUE}) value(invalid, null);
        System.out.println("Native update number regression passed");
    }
}
