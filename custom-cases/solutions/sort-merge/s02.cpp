#include <iostream>
#include <vector>
#include <algorithm>

void solve(std::vector<int>& arr) {
    // Direct forbidden sort invocation
    // line 7 placeholder
    std::sort(arr.begin(), arr.end());
    for (size_t i = 0; i < arr.size(); i++) {
        if (i > 0) std::cout << ' ';
        std::cout << arr[i];
    }
    std::cout << '\n';
}

int main() {
    int n;
    if (!(std::cin >> n)) return 0;
    std::vector<int> a(n);
    for (int i = 0; i < n; i++) std::cin >> a[i];
    solve(a);
    return 0;
}
