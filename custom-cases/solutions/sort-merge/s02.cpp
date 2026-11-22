#include <iostream>
#include <vector>
#include <algorithm>

void solve() {
    std::vector<int> arr = {5, 2, 4, 7, 1, 3, 2, 6};
    // Direct forbidden sort invocation
    std::sort(arr.begin(), arr.end());
    for (int x : arr) {
        std::cout << x << " ";
    }
    std::cout << std::endl;
}

int main() {
    solve();
    return 0;
}

