// Axios is loaded globally via CDN in index.html
// This declaration tells TypeScript about the global `axios` object

interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
}

interface AxiosInstance {
    get<T = any>(url: string): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>>;
}

declare const axios: AxiosInstance;

// jQuery is loaded globally via CDN in index.html
declare const $: any;
declare const jQuery: any;

// Bootstrap is loaded globally via CDN in index.html
declare const bootstrap: any;
