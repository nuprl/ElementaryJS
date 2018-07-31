let tests: {
    failed: boolean,
    description: string,
    error: string,
    miliElapsed: number
}[] = [];

export const testingFunctions = ['assertEquals', 'assertNotEquals'];

export function assertEquals(expected: any, actual: any) {
    if (expected === actual) {
        return true;
    }
    throw new Error(`Assertion failed\n  Expected: ${expected}\n  Actual: ${actual}`);
}

export function assertNotEquals(expected: any, actual: any) {
    if (expected !== actual) {
        return true;
    }
    throw new Error(`Assertion failed\n  Expected: ${expected}\n  Actual: ${actual}`);
}

export function test(description: string, testFunction: () => void) {
    const start = Date.now(); // I should use perfomance.now but I don't think it matters that much
    try { // I just want some cool numbers showing up
        testFunction();
        const end = Date.now(); 
        tests.push({
            failed: false,
            description: description,
            error: '',
            miliElapsed: end - start,
        });
    } catch (e) {
        const end = Date.now();
        tests.push({
            failed: true,
            description: description,
            error: e.message,
            miliElapsed: end - start,
        });

    }
}

export function summary() {
    if (tests.length === 0) {
        console.log(`%c◈ You don't seem to have any tests written`, 'color: #e87ce8');
        console.log(`%c◈ To run a test, begin a function name with 'test'`, 'color: #e87ce8');
        return;
    }
    let numPassed = 0;
    let numFailed = 0;
    let totalMili = 0;
    for (let result of tests) {
        totalMili += result.miliElapsed;
        if (result.failed) {
            console.log(
                `%c FAILED %c ${result.description} (${result.miliElapsed.toFixed(0)}ms)\n${result.error}`,
                'background-color: #f44336; font-weight: bold',
                'color: inherit; background-color: inherit'
            );
            numFailed += 1;
            continue;
        }
        console.log(
            `%c OK %c ${result.description} (${result.miliElapsed.toFixed(0)}ms)`,
            'background-color: #2ac093; font-weight: bold',
            'color: inherit; background-color: inherit'
        );
        numPassed += 1;
    }
    console.log(`Tests:     %c${numFailed} failed, %c${numPassed} passed, %c${numPassed + numFailed} total`,
    'color: #f44336; font-weight: bold', 'color: #2ac093; font-weight: bold', 'font-weight: bold'
    );
    console.log(`Time:      ${(totalMili / 1000).toFixed(2)}s`);
    tests = [];
}