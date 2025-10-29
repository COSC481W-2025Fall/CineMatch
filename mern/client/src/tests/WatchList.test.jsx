// src/tests/WatchList.test.jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'     // utilities to render react components
import WatchListPage from '../components/WatchList'
import { BrowserRouter } from 'react-router-dom'    // wrap App to use React router for navigation

// mocks
beforeEach(() => {
  // mock watchlist in localStorage
  localStorage.setItem('watched', JSON.stringify([1]))

  // if URL contains /record/details/, return mocked movie object
  global.fetch = vi.fn((url) => {               // mock successful api call
    if (url.includes('/record/details/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Inception',
            year: 2010,
            genre: ['Action', 'Sci-Fi'],
            rating: 8.8,
          }),
      })
    }
    // mock general fetch for watchlist movies API
    return Promise.resolve({
      ok: true,
      json: () =>           // json returned contents for "Inception"
        Promise.resolve([
          {
            id: 1,
            title: 'Inception',
            year: 2010,
            genre: ['Action', 'Sci-Fi'],
            rating: 8.8,
            posterUrl: 'https://test.poster/inception.jpg',
          },
        ]),
    })
  })
})
// clear mocks and localStorage after each test
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})
// test suite
describe('WatchListPage', () => {
  // test 1 - initial loading state, render app in fake router and verify app shows loading indicator  
  it('renders initial loading state', () => {
    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })
  // test 2 - fetch and display movies, confirm data loading and rendering from mock api
  it('displays movies from watchlist', async () => {
    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )

    // wait for movie card to appear using title text
    await waitFor(() => screen.getByText('Inception'))

    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.getByText('2010 • Action, Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('⭐ 8.8')).toBeInTheDocument()
  })
  // test 3 - no movies in watchlist show empty watchlist message
  it('shows empty watchlist message if no matches', async () => {
    localStorage.setItem('watched', JSON.stringify([999])) // ID that doesn’t match any movie to simulate an empty watchlist

    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )

    await waitFor(() =>
      expect(
        screen.getByText(/Your watch list is empty/i)
      ).toBeInTheDocument()
    )
  })
  // test 4 - api error handling, if fetch fails page should load "error loading results"
  it('handles fetch error gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )

    await waitFor(() =>
      expect(screen.getByText(/Error loading results/i)).toBeInTheDocument()
    )
  })
  // test 5 - Search interaction, find input by placeholder, "TITLE", simulate typing "Inception", simulate clicking "SEARCH" button
  it('updates search params and triggers new search', async () => {
    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )

    // wait for movie card
    await waitFor(() => screen.getByText('Inception'))

    // change title input
    const titleInput = screen.getByPlaceholderText(/TITLE.../i)
    fireEvent.change(titleInput, { target: { value: 'Inception' } })

    // click the sidebar SEARCH button by role and text
    const searchButton = screen.getAllByRole('button', { name: /SEARCH/i })[0]
    fireEvent.click(searchButton)

    // ensure fetch called again
    expect(global.fetch).toHaveBeenCalled()
    expect(titleInput.value).toBe('Inception')
  })
  // test 6 - simulate clicking movie to open modal and confirm modal shows movie info
  it('opens MovieDetails modal when a movie is clicked', async () => {
    render(
      <BrowserRouter>
        <WatchListPage />
      </BrowserRouter>
    )

    // wait for movie card
    await waitFor(() => screen.getByText('Inception'))

    const movieCard = screen.getByText('Inception').closest('article')
    fireEvent.click(movieCard)

    // movieDetails content should appear
    await waitFor(() => screen.getByText('Inception'))
    expect(screen.getByText('2010 • Action, Sci-Fi')).toBeInTheDocument()
    expect(screen.getByText('⭐ 8.8')).toBeInTheDocument()
  })
})
