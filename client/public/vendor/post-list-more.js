/**
 * Published post-list Show more: fetch the next page of public posts and append cards.
 * Numbered pages are real links; this script only handles the Show more button.
 */
(function initPostListMore() {
	if (typeof document === "undefined") return;

	function visitorSiteIdHint() {
		try {
			var fromQuery = new URLSearchParams(location.search).get("siteId");
			if (fromQuery) return fromQuery;
			var pathMatch = location.pathname.match(/^\/sites\/([^/]+)\//);
			if (!pathMatch || !pathMatch[1]) return "";
			return decodeURIComponent(pathMatch[1]);
		} catch (err) {
			return "";
		}
	}

	function withSiteId(url) {
		var siteId = visitorSiteIdHint();
		if (!siteId) return url;
		return url + (url.indexOf("?") >= 0 ? "&" : "?") + "siteId=" + encodeURIComponent(siteId);
	}

	function isSafeHttpUrl(url) {
		if (!url || typeof url !== "string") return false;
		var trimmed = url.trim();
		if (!trimmed) return false;
		if (trimmed.charAt(0) === "/" && trimmed.charAt(1) !== "/") return true;
		try {
			var parsed = new URL(trimmed);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch (err) {
			return false;
		}
	}

	function escapeText(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function formatDate(iso) {
		if (!iso) return "";
		try {
			return new Date(iso).toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch (err) {
			return "";
		}
	}

	function flagOn(root, name) {
		return root.getAttribute(name) !== "0";
	}

	function cardHtml(root, post) {
		var slug = typeof post.slug === "string" ? post.slug : "";
		var title = typeof post.title === "string" ? post.title : "Untitled";
		var excerpt = typeof post.excerpt === "string" ? post.excerpt : "";
		var image = typeof post.featuredImage === "string" ? post.featuredImage : "";
		var publishedAt = typeof post.publishedAt === "string" ? post.publishedAt : "";
		var authorName = post.author && typeof post.author.name === "string" ? post.author.name : (typeof post.authorName === "string" ? post.authorName : "");
		var openIn = root.getAttribute("data-np-open") || "overlay";
		var isList = root.className.indexOf("np-post-list--list") !== -1;
		var href = slug ? "/post/" + encodeURIComponent(slug) : "#";
		var imageHtml =
			flagOn(root, "data-np-image") && image && isSafeHttpUrl(image)
				? '<img class="np-post-list__image" src="' + escapeText(image) + '" alt="">'
				: "";
		var excerptHtml =
			flagOn(root, "data-np-excerpt") && excerpt ? '<p class="np-post-list__excerpt">' + escapeText(excerpt) + "</p>" : "";
		var dateText = flagOn(root, "data-np-date") && publishedAt ? formatDate(publishedAt) : "";
		var authorText = flagOn(root, "data-np-author") ? authorName : "";
		var meta = "";
		if (dateText || authorText) {
			meta =
				'<small class="np-post-list__meta">' +
				escapeText(dateText) +
				(dateText && authorText ? " · " : "") +
				escapeText(authorText) +
				"</small>";
		}
		return (
			'<article class="np-post-list__card"><a class="np-post-list__link" href="' +
			escapeText(href) +
			'" data-np-post-slug="' +
			escapeText(slug) +
			'" data-np-open="' +
			escapeText(openIn) +
			'" style="text-decoration:none;color:inherit;display:flex;flex-direction:' +
			(isList ? "row" : "column") +
			";gap:" +
			(isList ? "1rem" : "0") +
			';">' +
			imageHtml +
			'<div class="np-post-list__body"><strong class="np-post-list__title">' +
			escapeText(title) +
			"</strong>" +
			excerptHtml +
			meta +
			"</div></a></article>"
		);
	}

	function loadNext(root, button) {
		if (button.getAttribute("aria-busy") === "true") return;
		var page = Number(root.getAttribute("data-np-page") || "1") + 1;
		var perPage = Number(root.getAttribute("data-np-per-page") || "6");
		var params = new URLSearchParams({
			page: String(page),
			per_page: String(perPage),
		});
		var blogId = root.getAttribute("data-np-blog") || "";
		var category = root.getAttribute("data-np-category") || "";
		var sort = root.getAttribute("data-np-sort") || "createdAt";
		var order = root.getAttribute("data-np-order") || "desc";
		if (blogId) params.set("blogId", blogId);
		if (category) params.set("category", category);
		if (sort) params.set("sort", sort);
		if (order) params.set("order", order);
		button.setAttribute("aria-busy", "true");
		button.textContent = "Loading…";
		fetch(withSiteId("/api/public/posts?" + params.toString()), { credentials: "same-origin" })
			.then(function (res) {
				if (!res.ok) throw new Error("Failed to load posts");
				return res.json();
			})
			.then(function (json) {
				var posts = Array.isArray(json) ? json : json.posts || [];
				var wrap = document.createElement("div");
				for (var i = 0; i < posts.length; i += 1) {
					wrap.insertAdjacentHTML("beforeend", cardHtml(root, posts[i]));
				}
				while (wrap.firstChild) {
					root.insertBefore(wrap.firstChild, button.parentNode);
				}
				root.setAttribute("data-np-page", String(page));
				var totalPages = Number(json.total_pages || root.getAttribute("data-np-total-pages") || "1");
				if (page >= totalPages || posts.length < perPage) {
					button.parentNode.remove();
				} else {
					button.removeAttribute("aria-busy");
					button.textContent = "Show more";
				}
			})
			.catch(function () {
				button.removeAttribute("aria-busy");
				button.textContent = "Show more";
			});
	}

	document.addEventListener("click", function (event) {
		var target = event.target;
		if (!(target instanceof Element)) return;
		var button = target.closest("[data-np-more-btn]");
		if (!button) return;
		var root = button.closest("[data-np-more='show-more']");
		if (!root) return;
		event.preventDefault();
		loadNext(root, button);
	});
})();
