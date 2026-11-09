// Auth module: register, sign in, check the session, sign out.
// Lecture links: 5.3 (IIFE module), 8.1/8.2 (fetch + promises, POSTing JSON), 9.2 (session-based sign in)

const Auth = (function () {
    let user = null;

    const post = (url, data) => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    }).then((res) => res.json());

    const register = (data) => post("/register", data);

    const signin = function (username, password) {
        return post("/signin", { username, password }).then(function (json) {
            if (json.status === "success") user = json.user;
            return json;
        });
    };

    // The session cookie survives a refresh, so this tells us if we're still signed in
    const validate = function () {
        return fetch("/validate").then((res) => res.json()).then(function (json) {
            user = json.status === "success" ? json.user : null;
            return user;
        });
    };

    const signout = function () {
        return fetch("/signout").then(() => { user = null; });
    };

    // Is this username already registered? (the server checks again when the form is posted)
    const usernameTaken = function (username) {
        return fetch("/check-username?username=" + encodeURIComponent(username))
            .then((res) => res.json()).then((json) => json.taken);
    };

    const getUser = () => user;

    return { register, signin, validate, signout, usernameTaken, getUser };
})();
