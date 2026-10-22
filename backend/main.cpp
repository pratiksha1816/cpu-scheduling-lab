// CPU Scheduling Lab backend: scheduling engine + tiny HTTP server (no external libraries).
// Build: g++ -std=c++17 -O2 main.cpp -o scheduler        (Windows/MinGW: add -lws2_32)
// Run:   ./scheduler [frontend_dir=../docs] [port=8080]
#include <algorithm>
#include <climits>
#include <deque>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>
#ifdef _WIN32
#include <winsock2.h>
typedef SOCKET Sock;
typedef int socklen_t;
#else
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
typedef int Sock;
#define closesocket close
#endif
using namespace std;

struct Proc { int i, at, bt, pr, rem, ct = -1, rt = -1; };
struct Seg { int id, s, e; };  // id = -1 means CPU idle
struct Result { vector<Seg> seg; vector<Proc> p; int end = 0, cs = 0; double util = 0, wt = 0, tat = 0, rt = 0, thr = 0; };

// ---------------- Scheduling engine ----------------
Result simulate(vector<Proc> P, const string& alg, int q) {
    Result R; int n = P.size(), t = 0, done = 0;
    auto push = [&](int id, int a, int b) {
        if (!R.seg.empty() && R.seg.back().id == id && R.seg.back().e == a) R.seg.back().e = b;
        else R.seg.push_back({id, a, b});
    };
    auto run = [&](Proc& p, int d) {
        if (p.rt < 0) p.rt = t - p.at;
        push(p.i, t, t + d); t += d; p.rem -= d;
        if (p.rem == 0) { p.ct = t; done++; }
    };
    auto nextArr = [&]() { int m = INT_MAX; for (auto& p : P) if (p.at > t) m = min(m, p.at); return m; };

    if (alg == "rr") {
        vector<int> ord(n); for (int i = 0; i < n; i++) ord[i] = i;
        stable_sort(ord.begin(), ord.end(), [&](int a, int b) { return P[a].at < P[b].at; });
        deque<int> Q; vector<bool> added(n, false);
        auto addArr = [&]() { for (int k : ord) if (P[k].at <= t && !added[k]) { added[k] = true; Q.push_back(k); } };
        while (done < n) {
            addArr();
            if (Q.empty()) { int a = nextArr(); push(-1, t, a); t = a; continue; }
            int k = Q.front(); Q.pop_front();
            run(P[k], min(q, P[k].rem));
            addArr();                       // arrivals during the slice queue before the preempted process
            if (P[k].rem > 0) Q.push_back(k);
        }
    } else {
        bool preemptive = (alg == "srtf" || alg == "pp");
        auto key = [&](const Proc& p) -> int {
            if (alg == "fcfs") return p.at;
            if (alg == "sjf") return p.bt;
            if (alg == "srtf") return p.rem;
            return p.pr;                    // pnp, pp: lower number = higher priority
        };
        while (done < n) {
            int best = -1;
            for (int k = 0; k < n; k++) {
                if (P[k].at > t || P[k].rem == 0) continue;
                if (best < 0 || make_tuple(key(P[k]), P[k].at, P[k].i) < make_tuple(key(P[best]), P[best].at, P[best].i)) best = k;
            }
            if (best < 0) { int a = nextArr(); push(-1, t, a); t = a; continue; }
            run(P[best], preemptive ? 1 : P[best].rem);
        }
    }
    R.end = t; int busy = 0, prev = -1;
    for (auto& s : R.seg) if (s.id >= 0) { busy += s.e - s.s; if (prev >= 0 && prev != s.id) R.cs++; prev = s.id; }
    for (auto& p : P) { R.wt += p.ct - p.at - p.bt; R.tat += p.ct - p.at; R.rt += p.rt; }
    R.wt /= n; R.tat /= n; R.rt /= n; R.util = 100.0 * busy / t; R.thr = double(n) / t; R.p = P;
    return R;
}

string toJson(const Result& r) {
    ostringstream o; o << "{\"seg\":[";
    for (size_t k = 0; k < r.seg.size(); k++)
        o << (k ? "," : "") << "{\"id\":" << (r.seg[k].id < 0 ? "null" : to_string(r.seg[k].id)) << ",\"s\":" << r.seg[k].s << ",\"e\":" << r.seg[k].e << "}";
    o << "],\"rows\":[";
    for (size_t k = 0; k < r.p.size(); k++) {
        const Proc& p = r.p[k];
        o << (k ? "," : "") << "{\"i\":" << p.i << ",\"at\":" << p.at << ",\"bt\":" << p.bt << ",\"pr\":" << p.pr << ",\"ct\":" << p.ct
          << ",\"tat\":" << p.ct - p.at << ",\"wt\":" << p.ct - p.at - p.bt << ",\"rt\":" << p.rt << "}";
    }
    o << "],\"end\":" << r.end << ",\"cs\":" << r.cs << ",\"util\":" << r.util << ",\"wt\":" << r.wt << ",\"tat\":" << r.tat
      << ",\"rt\":" << r.rt << ",\"thr\":" << r.thr << "}";
    return o.str();
}

// ---------------- API: body = algo=fcfs&q=2&procs=at,bt,pr;at,bt,pr ----------------
string field(const string& b, const string& k) {
    size_t p = b.find("&" + k + "="); if (p == string::npos) return "";
    p += k.size() + 2; size_t e = b.find('&', p);
    return b.substr(p, e == string::npos ? e : e - p);
}
bool api(const string& body, string& out) {
    string b = "&" + body, algo = field(b, "algo"), pr = field(b, "procs");
    int q = max(1, atoi(field(b, "q").c_str()));
    for (char& c : pr) if (c == ';' || c == ',') c = ' ';
    istringstream in(pr); vector<Proc> P; int a, bt, p;
    while (in >> a >> bt >> p) { int i = P.size(); P.push_back({i, max(0, a), max(1, bt), p, max(1, bt)}); }
    if (P.empty() || P.size() > 50) return false;
    if (algo == "all") {
        out = "{"; const char* names[] = {"fcfs", "sjf", "srtf", "pnp", "pp", "rr"};
        for (int k = 0; k < 6; k++) out += string(k ? "," : "") + "\"" + names[k] + "\":" + toJson(simulate(P, names[k], q));
        out += "}"; return true;
    }
    if (algo != "fcfs" && algo != "sjf" && algo != "srtf" && algo != "pnp" && algo != "pp" && algo != "rr") return false;
    out = toJson(simulate(P, algo, q)); return true;
}

// ---------------- Minimal HTTP server ----------------
string mime(const string& f) {
    auto ends = [&](const char* e) { string s = e; return f.size() >= s.size() && f.compare(f.size() - s.size(), s.size(), s) == 0; };
    if (ends(".html")) return "text/html; charset=utf-8";
    if (ends(".css")) return "text/css; charset=utf-8";
    if (ends(".js")) return "application/javascript; charset=utf-8";
    if (ends(".json")) return "application/json";
    return "application/octet-stream";
}
void reply(Sock c, const string& status, const string& type, const string& body) {
    string r = "HTTP/1.1 " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + to_string(body.size()) + "\r\nConnection: close\r\n\r\n" + body;
    size_t sent = 0;
    while (sent < r.size()) { int n = send(c, r.data() + sent, (int)(r.size() - sent), 0); if (n <= 0) break; sent += n; }
}
void handle(Sock c, const string& root) {
    string req; char buf[4096]; size_t he;
    while ((he = req.find("\r\n\r\n")) == string::npos) {
        int n = recv(c, buf, sizeof buf, 0); if (n <= 0) return;
        req.append(buf, n); if (req.size() > 65536) return;
    }
    string low = req.substr(0, he); transform(low.begin(), low.end(), low.begin(), ::tolower);
    size_t cl = 0, p = low.find("content-length:"); if (p != string::npos) cl = stoul(low.substr(p + 15));
    while (req.size() < he + 4 + cl) { int n = recv(c, buf, sizeof buf, 0); if (n <= 0) break; req.append(buf, n); }
    string method, path; istringstream(req) >> method >> path;
    path = path.substr(0, path.find('?'));
    if (method == "POST" && path == "/api/simulate") {
        string out;
        if (api(req.substr(he + 4), out)) reply(c, "200 OK", "application/json", out);
        else reply(c, "400 Bad Request", "application/json", "{\"error\":\"bad request\"}");
    } else if (method == "GET") {
        if (path == "/") path = "/index.html";
        if (path.find("..") != string::npos) { reply(c, "403 Forbidden", "text/plain", "Forbidden"); return; }
        ifstream f(root + path, ios::binary);
        if (!f) { reply(c, "404 Not Found", "text/plain", "Not found"); return; }
        stringstream ss; ss << f.rdbuf(); reply(c, "200 OK", mime(path), ss.str());
    } else reply(c, "405 Method Not Allowed", "text/plain", "Method not allowed");
}

int main(int argc, char** argv) {
    string root = argc > 1 ? argv[1] : "../docs"; int port = argc > 2 ? atoi(argv[2]) : 8080;
#ifdef _WIN32
    WSADATA w; WSAStartup(MAKEWORD(2, 2), &w);
#endif
    Sock s = socket(AF_INET, SOCK_STREAM, 0); int on = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (const char*)&on, sizeof on);
    sockaddr_in a{}; a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); a.sin_port = htons(port);
    if (bind(s, (sockaddr*)&a, sizeof a) < 0 || listen(s, 16) < 0) { cerr << "Cannot listen on port " << port << "\n"; return 1; }
    cout << "CPU Scheduling Lab running at http://localhost:" << port << "  (frontend: " << root << ")\n";
    for (;;) { Sock c = accept(s, nullptr, nullptr); if (c < 0) continue; handle(c, root); closesocket(c); }
}
